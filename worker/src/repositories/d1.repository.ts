import { injectable, inject } from 'inversify';
import { TYPES, type ID1Repository } from '../interfaces.js';

@injectable()
export class D1Repository implements ID1Repository {
  constructor(@inject(TYPES.D1Database) private readonly db: D1Database) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql).bind(...params);
    const result = await stmt.all<T>();

    return result.results ?? [];
  }

  first<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    return this.db.prepare(sql).bind(...params).first<T>();
  }

  async execute(sql: string, params: unknown[] = []): Promise<D1ExecResult> {
    const stmt = this.db.prepare(sql).bind(...params);
    const result = await stmt.run();

    return {
      count: result.meta.changes ?? 0,
      duration: result.meta.duration ?? 0,
    };
  }

  run<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<D1Result<T>> {
    return this.db.prepare(sql).bind(...params).run<T>();
  }

  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return this.db.batch<T>(statements);
  }
}
