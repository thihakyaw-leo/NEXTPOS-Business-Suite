export interface Env {
  KV: KVNamespace;
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  GRAB_API_BASE_URL?: string;
  GRAB_CLIENT_ID?: string;
  GRAB_CLIENT_SECRET?: string;
  GRAB_CITY_CODE?: string;
  GRAB_SENDER_NAME?: string;
  GRAB_SENDER_PHONE?: string;
  GRAB_SENDER_EMAIL?: string;
}
