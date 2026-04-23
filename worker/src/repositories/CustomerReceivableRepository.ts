import { inject, injectable } from 'inversify';
import {
  TYPES,
  type CustomerReceivableUpsertInput,
  type ICustomerReceivableRepository,
} from '../interfaces.js';

@injectable()
export class CustomerReceivableRepository implements ICustomerReceivableRepository {
  constructor(@inject(TYPES.D1Database) private readonly db: D1Database) {}

  buildUpsertStatement(input: CustomerReceivableUpsertInput): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO tx_customer_receivable
         (tenant_id, customer_name, customer_phone, balance_amount, last_sale_number, last_sale_id,
          isdeleted, createdate, updatedate)
         VALUES (?, ?, ?, ?, ?, (
           SELECT id
           FROM tx_sale_sale
           WHERE tenant_id = ?
             AND sale_number = ?
         ), 0, ?, ?)
         ON CONFLICT(tenant_id, customer_name, customer_phone) DO UPDATE SET
           balance_amount = tx_customer_receivable.balance_amount + excluded.balance_amount,
           last_sale_number = excluded.last_sale_number,
           last_sale_id = excluded.last_sale_id,
           isdeleted = 0,
           updatedate = excluded.updatedate`,
      )
      .bind(
        input.tenant_id,
        input.customer_name,
        input.customer_phone ?? '',
        input.balance_amount,
        input.sale_number,
        input.tenant_id,
        input.sale_number,
        input.createdate,
        input.updatedate,
      );
  }
}
