import { inject, injectable } from 'inversify';
import {
  TYPES,
  type ID1Repository,
  type IInventoryService,
  type InventoryStockRecord,
  type UpsertProductInput,
} from '../interfaces.js';

export class InventoryValidationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'InventoryValidationError';
  }
}

@injectable()
export class InventoryService implements IInventoryService {
  constructor(@inject(TYPES.ID1Repository) private readonly db: ID1Repository) {}

  async listProducts(tenantId: string): Promise<InventoryStockRecord[]> {
    return this.db.query<InventoryStockRecord>(
      `SELECT * FROM t_inventory_stock WHERE tenant_id = ? AND isdeleted = 0 ORDER BY item_code ASC`,
      [tenantId],
    );
  }

  async getProduct(tenantId: string, itemCode: string): Promise<InventoryStockRecord | null> {
    const product = await this.db.first<InventoryStockRecord>(
      `SELECT * FROM t_inventory_stock WHERE tenant_id = ? AND item_code = ? AND isdeleted = 0`,
      [tenantId, itemCode],
    );
    return product ?? null;
  }

  async upsertProduct(input: UpsertProductInput): Promise<InventoryStockRecord> {
    if (!input.item_code?.trim() || !input.item_name?.trim()) {
      throw new InventoryValidationError('item_code and item_name are required');
    }

    const now = new Date().toISOString();
    const existing = await this.getProduct(input.tenant_id, input.item_code);

    if (existing) {
      await this.db.execute(
        `UPDATE t_inventory_stock 
         SET item_name = ?, barcode = ?, category = ?, unit = ?, location_code = ?,
             quantity_on_hand = ?, reorder_level = ?, cost_price = ?, selling_price = ?, updatedate = ?
         WHERE tenant_id = ? AND item_code = ? AND isdeleted = 0`,
        [
          input.item_name,
          input.barcode ?? existing.barcode,
          input.category ?? existing.category,
          input.unit || existing.unit,
          input.location_code ?? existing.location_code,
          input.quantity_on_hand ?? existing.quantity_on_hand,
          input.reorder_level ?? existing.reorder_level,
          input.cost_price ?? existing.cost_price,
          input.selling_price ?? existing.selling_price,
          now,
          input.tenant_id,
          input.item_code,
        ],
      );
    } else {
      await this.db.execute(
        `INSERT INTO t_inventory_stock 
         (tenant_id, item_code, item_name, barcode, category, unit, location_code, quantity_on_hand, reorder_level, cost_price, selling_price, createdate, updatedate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.tenant_id,
          input.item_code,
          input.item_name,
          input.barcode ?? null,
          input.category ?? 'other',
          input.unit || 'PCS',
          input.location_code ?? 'MAIN',
          input.quantity_on_hand ?? 0,
          input.reorder_level ?? 0,
          input.cost_price ?? 0,
          input.selling_price ?? 0,
          now,
          now,
        ],
      );
    }

    const result = await this.getProduct(input.tenant_id, input.item_code);
    if (!result) {
      throw new InventoryValidationError('Failed to retrieve product after upsert', 500);
    }

    return result;
  }

  async deleteProduct(tenantId: string, itemCode: string): Promise<void> {
    const existing = await this.getProduct(tenantId, itemCode);
    if (!existing) {
      throw new InventoryValidationError('Product not found', 404);
    }

    await this.db.execute(
      `UPDATE t_inventory_stock SET isdeleted = 1, updatedate = ? WHERE tenant_id = ? AND item_code = ?`,
      [new Date().toISOString(), tenantId, itemCode],
    );
  }
}
