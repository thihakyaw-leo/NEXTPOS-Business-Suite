import { inject, injectable } from 'inversify';
import {
  TYPES,
  type AvgCostUpdateInput,
  type CostingMethod,
  type FifoSaleInput,
  type ICostingService,
  type ID1Repository,
  type IInventoryLedgerRepository,
  type InventoryStockRecord,
  type SaleCostingInput,
  type SaleCostingLine,
  type SaleCostingPlan,
  type ValidatedSaleDetail,
} from '../interfaces.js';

type GroupedSaleMovement = {
  item_code: string;
  location_code: string;
  quantity: number;
  stock: InventoryStockRecord;
};

@injectable()
export class CostingService implements ICostingService {
  constructor(
    @inject(TYPES.D1Database) private readonly db: D1Database,
    @inject(TYPES.ID1Repository) private readonly d1: ID1Repository,
    @inject(TYPES.IInventoryLedgerRepository)
    private readonly ledgerRepository: IInventoryLedgerRepository,
  ) {}

  async processSale(input: SaleCostingInput): Promise<SaleCostingPlan> {
    const groupedMovements = this.groupDetails(input.details);
    const statements: D1PreparedStatement[] = [];
    const lines: SaleCostingLine[] = [];
    let totalCogs = 0;

    for (const movement of groupedMovements) {
      const plan =
        input.method === 'FIFO'
          ? await this.processFIFO({
              tenantId: input.tenantId,
              invoiceNo: input.invoiceNo,
              saleDate: input.saleDate,
              itemCode: movement.item_code,
              locationCode: movement.location_code,
              quantity: movement.quantity,
              stock: movement.stock,
            })
          : this.buildAverageSalePlan(
              input.invoiceNo,
              input.saleDate,
              movement.item_code,
              movement.location_code,
              movement.quantity,
              movement.stock,
            );

      statements.push(...plan.statements);
      lines.push(...plan.lines);
      totalCogs += plan.total_cogs;
    }

    return {
      method: input.method,
      statements,
      lines,
      total_cogs: roundCurrency(totalCogs),
    };
  }

  async processAVG(input: AvgCostUpdateInput): Promise<number> {
    if (input.newQty <= 0) {
      throw new Error('AVG cost updates require a positive incoming quantity');
    }

    const locationCode = input.locationCode ?? 'MAIN';
    const stock = await this.d1.first<InventoryStockRecord>(
      `SELECT *
       FROM t_inventory_stock
       WHERE tenant_id = ?
         AND item_code = ?
         AND location_code = ?
         AND isdeleted = 0`,
      [input.tenantId, input.itemCode, locationCode],
    );

    if (!stock) {
      throw new Error(`Stock record not found for ${input.itemCode} at ${locationCode}`);
    }

    const now = new Date().toISOString();
    const oldQty = Number(stock.quantity_on_hand ?? 0);
    const oldCost = normalizeCost(stock.avg_cost || stock.cost_price);
    const weightedCost =
      ((oldQty * oldCost) + (input.newQty * input.newCost)) / (oldQty + input.newQty);
    const avgCost = Number.isFinite(weightedCost) ? roundCost(weightedCost) : 0;

    await this.d1.execute(
      `UPDATE t_inventory_stock
       SET avg_cost = ?, cost_price = ?, updatedate = ?
       WHERE tenant_id = ?
         AND item_code = ?
         AND location_code = ?
         AND isdeleted = 0`,
      [avgCost, avgCost, now, input.tenantId, input.itemCode, locationCode],
    );

    return avgCost;
  }

  async processFIFO(input: FifoSaleInput): Promise<SaleCostingPlan> {
    const layers = await this.ledgerRepository.getAvailableFifoLayers(
      input.tenantId,
      input.itemCode,
      input.locationCode,
    );

    const availableQuantity = layers.reduce((sum, layer) => sum + Number(layer.available_quantity), 0);

    if (availableQuantity < input.quantity) {
      throw new Error(
        `Insufficient FIFO layers for ${input.itemCode} at ${input.locationCode}: requested ${input.quantity}, available ${availableQuantity}`,
      );
    }

    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    let remaining = input.quantity;
    let itemCogs = 0;

    for (const layer of layers) {
      if (remaining <= 0) {
        break;
      }

      const consumeQty = Math.min(remaining, Number(layer.available_quantity));
      const unitCost = normalizeCost(layer.cost_price);

      statements.push(
        this.ledgerRepository.buildLedgerInsertStatement({
          tenant_id: input.tenantId,
          item_code: input.itemCode,
          location_code: input.locationCode,
          transaction_type: 'SALE_FIFO_CONSUMPTION',
          reference_type: 'SALE',
          reference_id: null,
          quantity_change: -consumeQty,
          quantity_before: roundQuantity(layer.available_quantity),
          quantity_after: roundQuantity(layer.available_quantity - consumeQty),
          cost_price: unitCost,
          source_ledger_id: layer.id,
          remarks: `FIFO consumption for invoice ${input.invoiceNo}`,
          transaction_date: input.saleDate,
          createdate: now,
          updatedate: now,
        }),
      );

      itemCogs += consumeQty * unitCost;
      remaining -= consumeQty;
    }

    statements.push(
      this.buildStockDeductionStatement(
        input.tenantId,
        input.itemCode,
        input.locationCode,
        input.quantity,
        now,
      ),
    );

    const totalCogs = roundCurrency(itemCogs);

    return {
      method: 'FIFO',
      statements,
      lines: [
        {
          item_code: input.itemCode,
          location_code: input.locationCode,
          quantity: roundQuantity(input.quantity),
          unit_cost: roundCost(totalCogs / input.quantity),
          line_cogs: totalCogs,
        },
      ],
      total_cogs: totalCogs,
    };
  }

  private buildAverageSalePlan(
    invoiceNo: string,
    saleDate: string,
    itemCode: string,
    locationCode: string,
    quantity: number,
    stock: InventoryStockRecord,
  ): SaleCostingPlan {
    const now = new Date().toISOString();
    const quantityBefore = roundQuantity(stock.quantity_on_hand);
    const unitCost = normalizeCost(stock.avg_cost || stock.cost_price);
    const lineCogs = roundCurrency(unitCost * quantity);

    return {
      method: 'AVG',
      statements: [
        this.ledgerRepository.buildLedgerInsertStatement({
          tenant_id: stock.tenant_id,
          item_code: itemCode,
          location_code: locationCode,
          transaction_type: 'SALE_AVG_CONSUMPTION',
          reference_type: 'SALE',
          reference_id: null,
          quantity_change: -quantity,
          quantity_before: quantityBefore,
          quantity_after: roundQuantity(quantityBefore - quantity),
          cost_price: unitCost,
          source_ledger_id: null,
          remarks: `AVG consumption for invoice ${invoiceNo}`,
          transaction_date: saleDate,
          createdate: now,
          updatedate: now,
        }),
        this.buildStockDeductionStatement(stock.tenant_id, itemCode, locationCode, quantity, now),
      ],
      lines: [
        {
          item_code: itemCode,
          location_code: locationCode,
          quantity: roundQuantity(quantity),
          unit_cost: unitCost,
          line_cogs: lineCogs,
        },
      ],
      total_cogs: lineCogs,
    };
  }

  private buildStockDeductionStatement(
    tenantId: string,
    itemCode: string,
    locationCode: string,
    quantity: number,
    updatedAt: string,
  ): D1PreparedStatement {
    return this.db
      .prepare(
        `UPDATE t_inventory_stock
         SET quantity_on_hand = quantity_on_hand - ?, updatedate = ?
         WHERE tenant_id = ?
           AND item_code = ?
           AND location_code = ?
           AND isdeleted = 0`,
      )
      .bind(quantity, updatedAt, tenantId, itemCode, locationCode);
  }

  private groupDetails(details: ValidatedSaleDetail[]): GroupedSaleMovement[] {
    const grouped = new Map<string, GroupedSaleMovement>();

    for (const detail of details) {
      const key = `${detail.item_code}::${detail.location_code}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity = roundQuantity(existing.quantity + detail.quantity);
        continue;
      }

      grouped.set(key, {
        item_code: detail.item_code,
        location_code: detail.location_code,
        quantity: roundQuantity(detail.quantity),
        stock: detail.stock,
      });
    }

    return [...grouped.values()];
  }
}

function normalizeCost(value: number | null | undefined): number {
  return roundCost(Number(value ?? 0));
}

function roundQuantity(value: number): number {
  return Number(value.toFixed(4));
}

function roundCost(value: number): number {
  return Number(value.toFixed(6));
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}
