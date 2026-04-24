export const TYPES = {
  Env: Symbol.for('Env'),
  D1Database: Symbol.for('D1Database'),
  R2Bucket: Symbol.for('R2Bucket'),
  ID1Repository: Symbol.for('ID1Repository'),
  IR2Repository: Symbol.for('IR2Repository'),
  IInventoryLedgerRepository: Symbol.for('IInventoryLedgerRepository'),
  ICustomerReceivableRepository: Symbol.for('ICustomerReceivableRepository'),
  ICostingService: Symbol.for('ICostingService'),
  ISaleService: Symbol.for('ISaleService'),
  IDeliveryService: Symbol.for('IDeliveryService'),
  IHrEmployeeService: Symbol.for('IHrEmployeeService'),
  IPayrollProcessor: Symbol.for('IPayrollProcessor'),
  IDeliveryProviderFactory: Symbol.for('IDeliveryProviderFactory'),
  MockDeliveryProvider: Symbol.for('MockDeliveryProvider'),
  GrabDeliveryProvider: Symbol.for('GrabDeliveryProvider'),
  KVNamespace: Symbol.for('KVNamespace'),
  IAuthService: Symbol.for('IAuthService'),
  IFeatureGuard: Symbol.for('IFeatureGuard'),
  IInventoryService: Symbol.for('IInventoryService'),
} as const;

type R2PutValue = Exclude<Parameters<R2Bucket['put']>[1], null>;

export interface ID1Repository {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<D1ExecResult>;
  run<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<D1Result<T>>;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface IR2Repository {
  put(key: string, value: R2PutValue, options?: R2PutOptions): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export type CostingMethod = 'AVG' | 'FIFO';
export type SnapshotStatus = 'PENDING' | 'COMMITTED' | 'FAILED';
export type SalePaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
export type DeliveryProviderCode = 'MOCK' | 'GRAB' | 'LALAMOVE' | 'MANUAL';
export type DeliveryStatus =
  | 'PENDING'
  | 'QUOTE'
  | 'ALLOCATING'
  | 'QUEUING'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export interface DeliveryDimensions {
  height: number;
  width: number;
  depth: number;
  weight: number;
}

export interface DeliveryPackageInput {
  name: string;
  description: string;
  quantity: number;
  price?: number;
  dimensions?: Partial<DeliveryDimensions>;
}

export interface DeliveryPartyInput {
  name: string;
  phone: string;
  email?: string | null;
  company_name?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  city_code?: string | null;
  keywords?: string | null;
  notes?: string | null;
}

export interface DeliveryEstimateInput {
  tenant_id: string;
  provider_codes?: DeliveryProviderCode[];
  pickup: DeliveryPartyInput;
  dropoff: DeliveryPartyInput;
  packages: DeliveryPackageInput[];
  order_total: number;
  distance_km?: number | null;
  currency?: string | null;
}

export interface DeliveryEstimateQuote {
  provider: DeliveryProviderCode;
  service_type: string;
  fee: number;
  currency: string;
  estimated_pickup_at?: string | null;
  estimated_dropoff_at?: string | null;
  distance_m?: number | null;
  quote_id?: string | null;
  message?: string | null;
  meta?: Record<string, unknown>;
}

export interface DeliveryCreateInput extends Omit<DeliveryEstimateInput, 'provider_codes' | 'packages'> {
  provider: DeliveryProviderCode;
  sale_id?: number;
  sale_number?: string;
  quoted_fee?: number | null;
  packages?: DeliveryPackageInput[];
}

export interface DeliveryCreateResult {
  provider: DeliveryProviderCode;
  tracking_id: string;
  status: DeliveryStatus;
  fee: number;
  cost: number;
  tracking_url?: string | null;
  waybill_no?: string | null;
  meta?: Record<string, unknown>;
}

export interface DeliveryWebhookUpdate {
  provider: DeliveryProviderCode;
  tracking_id?: string | null;
  sale_number?: string | null;
  tenant_id?: string | null;
  status: DeliveryStatus;
  fee?: number | null;
  cost?: number | null;
  meta?: Record<string, unknown>;
}

export interface IDeliveryProvider {
  readonly code: DeliveryProviderCode;
  estimate(input: DeliveryEstimateInput): Promise<DeliveryEstimateQuote[]>;
  createDelivery(input: DeliveryCreateInput): Promise<DeliveryCreateResult>;
  parseWebhook(request: Request, payload: unknown): Promise<DeliveryWebhookUpdate | null>;
}

export interface IDeliveryProviderFactory {
  getProvider(code: DeliveryProviderCode): IDeliveryProvider;
  getProviders(codes?: DeliveryProviderCode[]): IDeliveryProvider[];
}

export interface TenantRecord {
  tenant_id: string;
  company_code: string;
  company_name: string;
  email?: string | null;
  plan_type: string;
  enabled_features: string;
  trial_ends_at?: string | null;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface ActivationRecord {
  id?: number;
  tenant_id: string;
  hardware_id: string;
  activation_key: string;
  device_name?: string | null;
  activated_at?: string;
  expires_at?: string | null;
  last_seen_at?: string | null;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface RegisterTenantInput {
  company_name: string;
  email: string;
  device_fingerprint: string;
}

export interface LoginTenantInput {
  email: string;
  device_fingerprint: string;
}

export interface ValidateTenantInput {
  token: string;
  device_fingerprint: string;
}

export interface TenantJwtPayload {
  token_type: 'tenant';
  tenant_id: string;
  plan_type: string;
  features: string[];
  device_fingerprint: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface AdminJwtPayload {
  token_type: 'admin';
  role: 'admin';
  iat: number;
  exp: number;
  jti: string;
}

export interface RegisterTenantResult {
  token: string;
  tenant_id: string;
  plan_type: string;
  features: string[];
  trial_ends_at: string;
}

export interface TenantValidationResult {
  status: 'active' | 'expired';
  tenant_id?: string;
  plan_type?: string;
  features?: string[];
  trial_ends_at?: string | null;
  reason?: string;
}

export interface AdminAuthResult {
  token: string;
  cookie: string;
  expires_at: string;
}

export interface IAuthService {
  registerTenant(input: RegisterTenantInput): Promise<RegisterTenantResult | null>;
  loginTenant(input: LoginTenantInput): Promise<RegisterTenantResult | null>;
  validateTenant(input: ValidateTenantInput): Promise<TenantValidationResult>;
  verifyTenantToken(token: string): Promise<TenantJwtPayload | null>;
  authenticateAdmin(
    username: string,
    password: string,
    request: Request,
  ): Promise<AdminAuthResult | null>;
  verifyAdminToken(token: string): Promise<AdminJwtPayload | null>;
}

export interface IFeatureGuard {
  getTenantClaims(request: Request, expectedTenantId?: string): Promise<TenantJwtPayload | null>;
  hasFeature(claims: Pick<TenantJwtPayload, 'plan_type' | 'features'>, feature: string): boolean;
}

export interface HrEmployeeRecord {
  id?: number;
  tenant_id: string;
  code: string;
  name: string;
  position: string;
  base_salary: number;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface HrAttendanceRecord {
  id?: number;
  tenant_id: string;
  employee_id: number;
  check_in: string;
  check_out?: string | null;
  hours_worked: number;
  date: string;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export type HrPayrollPeriodStatus = 'DRAFT' | 'PROCESSING' | 'PROCESSED';

export interface HrPayrollPeriodRecord {
  id?: number;
  tenant_id: string;
  start_date: string;
  end_date: string;
  status: HrPayrollPeriodStatus;
  processed_at?: string | null;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface HrPayslipRecord {
  id?: number;
  tenant_id: string;
  period_id: number;
  employee_id: number;
  basic_pay: number;
  overtime_pay: number;
  deductions: number;
  net_pay: number;
  days_present: number;
  total_hours: number;
  overtime_hours: number;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface HrPayslipAggregate {
  employee: HrEmployeeRecord;
  payslip: HrPayslipRecord;
  period: HrPayrollPeriodRecord;
}

export interface UpsertHrEmployeeInput {
  tenant_id: string;
  code: string;
  name: string;
  position: string;
  base_salary: number;
}

export interface HrAttendanceClockInput {
  tenant_id: string;
  employee_id: number;
  timestamp?: string;
}

export interface HrAttendanceClockResult {
  action: 'CLOCK_IN' | 'CLOCK_OUT';
  attendance: HrAttendanceRecord;
  employee: HrEmployeeRecord;
}

export interface CreateHrPayrollPeriodInput {
  tenant_id: string;
  start_date: string;
  end_date: string;
}

export interface ProcessHrPayrollInput {
  tenant_id: string;
  period_id: number;
  deductions?: Array<{
    employee_id: number;
    amount: number;
  }>;
}

export interface SaleRecord {
  id?: number;
  tenant_id: string;
  sale_number: string;
  sale_date: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  net_amount: number;
  payment_method: SalePaymentMethod;
  status: string;
  notes?: string | null;
  cashier_id?: string | null;
  register_id?: string | null;
  delivery_provider?: DeliveryProviderCode | null;
  delivery_tracking_id?: string | null;
  delivery_status?: DeliveryStatus | null;
  delivery_fee?: number;
  delivery_cost?: number;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface InventoryStockRecord {
  id?: number;
  tenant_id: string;
  item_code: string;
  item_name: string;
  barcode?: string | null;
  category?: string | null;
  unit: string;
  location_code: string;
  quantity_on_hand: number;
  reorder_level: number;
  cost_price: number;
  avg_cost: number;
  selling_price: number;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface InventoryLedgerRecord {
  id?: number;
  tenant_id: string;
  item_code: string;
  location_code: string;
  transaction_type: string;
  reference_type?: string | null;
  reference_id?: number | null;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  cost_price: number;
  source_ledger_id?: number | null;
  remarks?: string | null;
  transaction_date: string;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface InventoryLedgerLayer extends InventoryLedgerRecord {
  id: number;
  available_quantity: number;
}

export interface CustomerReceivableRecord {
  id?: number;
  tenant_id: string;
  customer_name: string;
  customer_phone: string;
  balance_amount: number;
  last_sale_number?: string | null;
  last_sale_id?: number | null;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface CustomerReceivableUpsertInput {
  tenant_id: string;
  customer_name: string;
  customer_phone?: string | null;
  balance_amount: number;
  sale_number: string;
  createdate: string;
  updatedate: string;
}

export interface SaleDetailRecord {
  id?: number;
  tenant_id: string;
  sale_id: number;
  item_code: string;
  item_name: string;
  barcode?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  line_total: number;
  cost_price?: number;
  isdeleted?: number;
  createdate?: string;
  updatedate?: string;
}

export interface CreateSaleDetailInput {
  item_code: string;
  item_name: string;
  barcode?: string | null;
  location_code?: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax?: number;
  line_total: number;
  cost_price?: number;
}

export interface CreateSaleHeaderInput
  extends Omit<SaleRecord, 'id' | 'sale_number' | 'isdeleted' | 'createdate' | 'updatedate'> {
  sale_number?: string;
  invoice_no?: string;
  amount_paid?: number;
  costing_method?: CostingMethod;
}

export interface CreateSaleInput {
  sale: CreateSaleHeaderInput;
  details: CreateSaleDetailInput[];
}

export interface SaleAggregate {
  sale: SaleRecord;
  details: SaleDetailRecord[];
}

export interface SaleSnapshotPayload {
  sale: CreateSaleHeaderInput;
  details: CreateSaleDetailInput[];
  snapshot_key: string;
  status: SnapshotStatus;
  created_at: string;
  committed_at?: string;
  aggregate?: SaleAggregate;
  recovery_reason?: string;
}

export interface ValidatedSaleDetail extends CreateSaleDetailInput {
  location_code: string;
  stock: InventoryStockRecord;
}

export interface SaleCostingLine {
  item_code: string;
  location_code: string;
  quantity: number;
  unit_cost: number;
  line_cogs: number;
}

export interface SaleCostingPlan {
  method: CostingMethod;
  statements: D1PreparedStatement[];
  lines: SaleCostingLine[];
  total_cogs: number;
}

export interface AvgCostUpdateInput {
  tenantId: string;
  itemCode: string;
  locationCode?: string;
  newQty: number;
  newCost: number;
}

export interface FifoSaleInput {
  tenantId: string;
  invoiceNo: string;
  saleDate: string;
  itemCode: string;
  locationCode: string;
  quantity: number;
  stock: InventoryStockRecord;
}

export interface SaleCostingInput {
  tenantId: string;
  invoiceNo: string;
  saleDate: string;
  method: CostingMethod;
  details: ValidatedSaleDetail[];
}

export interface SaleRecoveryResult {
  snapshotKey: string;
  snapshot: SaleSnapshotPayload | null;
}

export interface ISaleService {
  getSales(tenantId: string): Promise<SaleRecord[]>;
  getSaleById(tenantId: string, saleId: number): Promise<SaleAggregate | null>;
  getSaleByNumber(tenantId: string, saleNumber: string): Promise<SaleAggregate | null>;
  createSale(payload: CreateSaleInput): Promise<SaleAggregate>;
  recoverSaleSnapshot(tenantId: string, invoiceNo: string): Promise<SaleRecoveryResult>;
}

export interface DeliveryCreateResponse {
  sale: SaleRecord;
  delivery: DeliveryCreateResult;
}

export interface DeliveryWebhookResult {
  updated: boolean;
  sale?: SaleRecord | null;
  event?: DeliveryWebhookUpdate | null;
}

export interface IDeliveryService {
  estimate(input: DeliveryEstimateInput): Promise<DeliveryEstimateQuote[]>;
  createDelivery(input: DeliveryCreateInput): Promise<DeliveryCreateResponse>;
  handleWebhook(request: Request, payload: unknown): Promise<DeliveryWebhookResult>;
}

export interface IHrEmployeeService {
  listEmployees(tenantId: string): Promise<HrEmployeeRecord[]>;
  getEmployeeById(tenantId: string, employeeId: number): Promise<HrEmployeeRecord | null>;
  createEmployee(input: UpsertHrEmployeeInput): Promise<HrEmployeeRecord>;
  updateEmployee(tenantId: string, employeeId: number, input: UpsertHrEmployeeInput): Promise<HrEmployeeRecord>;
  deleteEmployee(tenantId: string, employeeId: number): Promise<void>;
  clockAttendance(input: HrAttendanceClockInput): Promise<HrAttendanceClockResult>;
  listAttendance(tenantId: string, employeeId?: number): Promise<HrAttendanceRecord[]>;
}

export interface IPayrollProcessor {
  listPeriods(tenantId: string): Promise<HrPayrollPeriodRecord[]>;
  createPeriod(input: CreateHrPayrollPeriodInput): Promise<HrPayrollPeriodRecord>;
  processPeriod(input: ProcessHrPayrollInput): Promise<HrPayslipAggregate[]>;
  listPayslips(tenantId: string, periodId?: number): Promise<HrPayslipAggregate[]>;
}

export interface IInventoryLedgerRepository {
  getAvailableFifoLayers(
    tenantId: string,
    itemCode: string,
    locationCode: string,
  ): Promise<InventoryLedgerLayer[]>;
  buildLedgerInsertStatement(entry: InventoryLedgerRecord): D1PreparedStatement;
}

export interface ICustomerReceivableRepository {
  buildUpsertStatement(input: CustomerReceivableUpsertInput): D1PreparedStatement;
}

export interface ICostingService {
  processSale(input: SaleCostingInput): Promise<SaleCostingPlan>;
  processAVG(input: AvgCostUpdateInput): Promise<number>;
  processFIFO(input: FifoSaleInput): Promise<SaleCostingPlan>;
}

export interface UpsertProductInput {
  tenant_id: string;
  item_code: string;
  item_name: string;
  barcode?: string | null;
  category?: string | null;
  unit: string;
  location_code?: string;
  quantity_on_hand?: number;
  reorder_level?: number;
  cost_price?: number;
  selling_price?: number;
}

export interface IInventoryService {
  listProducts(tenantId: string): Promise<InventoryStockRecord[]>;
  getProduct(tenantId: string, itemCode: string): Promise<InventoryStockRecord | null>;
  upsertProduct(input: UpsertProductInput): Promise<InventoryStockRecord>;
  deleteProduct(tenantId: string, itemCode: string): Promise<void>;
}
