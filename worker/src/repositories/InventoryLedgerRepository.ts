import { inject, injectable } from 'inversify';
import {
  TYPES,
  type ID1Repository,
  type IInventoryLedgerRepository,
  type InventoryLedgerLayer,
  type InventoryLedgerRecord,
} from '../interfaces.js';

@injectable()
export class InventoryLedgerRepository implements IInventoryLedgerRepository {
  constructor(
    @inject(TYPES.D1Database) private readonly db: D1Database,
    @inject(TYPES.ID1Repository) private readonly d1: ID1Repository,
  ) {}

  getAvailableFifoLayers(
    tenantId: string,
    itemCode: string,
    locationCode: string,
  ): Promise<InventoryLedgerLayer[]> {
    return this.d1.query<InventoryLedgerLayer>(
      `SELECT *
       FROM (
         SELECT
           l.id,
           l.tenant_id,
           l.item_code,
           l.location_code,
           l.transaction_type,
           l.reference_type,
           l.reference_id,
           l.quantity_change,
           l.quantity_before,
           l.quantity_after,
           l.cost_price,
           l.source_ledger_id,
           l.remarks,
           l.transaction_date,
           l.isdeleted,
           l.createdate,
           l.updatedate,
           l.quantity_change - COALESCE((
             SELECT SUM(ABS(c.quantity_change))
             FROM inventory_ledger c
             WHERE c.source_ledger_id = l.id
               AND c.isdeleted = 0
               AND c.quantity_change < 0
           ), 0) AS available_quantity
         FROM inventory_ledger l
         WHERE l.tenant_id = ?
           AND l.item_code = ?
           AND l.location_code = ?
           AND l.isdeleted = 0
           AND l.quantity_change > 0
       ) fifo_layers
       WHERE available_quantity > 0
       ORDER BY createdate ASC, id ASC`,
      [tenantId, itemCode, locationCode],
    );
  }

  buildLedgerInsertStatement(entry: InventoryLedgerRecord): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO inventory_ledger
         (tenant_id, item_code, location_code, transaction_type, reference_type, reference_id,
          quantity_change, quantity_before, quantity_after, cost_price, source_ledger_id,
          remarks, transaction_date, isdeleted, createdate, updatedate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .bind(
        entry.tenant_id,
        entry.item_code,
        entry.location_code,
        entry.transaction_type,
        entry.reference_type ?? null,
        entry.reference_id ?? null,
        entry.quantity_change,
        entry.quantity_before,
        entry.quantity_after,
        entry.cost_price,
        entry.source_ledger_id ?? null,
        entry.remarks ?? null,
        entry.transaction_date,
        entry.createdate ?? entry.transaction_date,
        entry.updatedate ?? entry.transaction_date,
      );
  }
}
