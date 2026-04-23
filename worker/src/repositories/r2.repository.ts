import { injectable, inject } from 'inversify';
import { TYPES, type IR2Repository } from '../interfaces.js';

@injectable()
export class R2Repository implements IR2Repository {
  constructor(@inject(TYPES.R2Bucket) private readonly bucket: R2Bucket) {}

  put(
    key: string,
    value: Exclude<Parameters<R2Bucket['put']>[1], null>,
    options?: R2PutOptions,
  ): Promise<R2Object> {
    return this.bucket.put(key, value, options);
  }

  get(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  delete(key: string): Promise<void> {
    return this.bucket.delete(key);
  }

  list(options?: R2ListOptions): Promise<R2Objects> {
    return this.bucket.list(options);
  }
}
