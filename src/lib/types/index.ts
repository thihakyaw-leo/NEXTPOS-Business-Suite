/**
 * Shared TypeScript types for NextPOS frontend.
 */

// ── Product / Inventory ──────────────────────────────────────────────────────

export interface Product {
  id: string;
  itemCode: string;
  name: string;
  nameMy?: string;
  barcode: string;
  category: ProductCategory;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  icon: string;
}

export type ProductCategory =
  | 'food'
  | 'drinks'
  | 'snacks'
  | 'personal'
  | 'household'
  | 'stationery'
  | 'other';

export const CATEGORY_META: Record<ProductCategory, { label: string; labelMy: string; icon: string }> = {
  food:       { label: 'Food',          labelMy: 'အစားအသောက်',      icon: '🍚' },
  drinks:     { label: 'Drinks',        labelMy: 'အဖျော်ယမကာ',      icon: '🥤' },
  snacks:     { label: 'Snacks',        labelMy: 'မုန့်',             icon: '🍪' },
  personal:   { label: 'Personal Care', labelMy: 'ကိုယ်ပိုင်သုံး',   icon: '🧴' },
  household:  { label: 'Household',     labelMy: 'အိမ်သုံး',         icon: '🏠' },
  stationery: { label: 'Stationery',    labelMy: 'စာရေးကိရိယာ',     icon: '✏️' },
  other:      { label: 'Other',         labelMy: 'အခြား',           icon: '📦' },
};

// ── Cart ─────────────────────────────────────────────────────────────────────

export type CartLineKind = 'product' | 'service_charge';

export interface CartItem {
  id: string;
  itemCode: string;
  name: string;
  icon: string;
  price: number;
  quantity: number;
  discount: number;
  kind?: CartLineKind;
  editableQuantity?: boolean;
  meta?: Record<string, unknown>;
}

// ── Sales ────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
export type SaleStatus = 'COMPLETED' | 'VOIDED' | 'REFUNDED';
export type DeliveryProvider = 'MOCK' | 'GRAB' | 'LALAMOVE' | 'MANUAL';
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

export interface DeliveryQuote {
  provider: DeliveryProvider;
  serviceType: string;
  fee: number;
  currency: string;
  estimatedPickupAt?: string | null;
  estimatedDropoffAt?: string | null;
  distanceM?: number | null;
  quoteId?: string | null;
  message?: string | null;
}

export interface DeliverySelection {
  provider: DeliveryProvider;
  fee: number;
  currency: string;
  serviceType: string;
  quoteId?: string | null;
  trackingId?: string | null;
  status?: DeliveryStatus | null;
  pickupAddress?: string;
  dropoffAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  note?: string;
}

export interface Sale {
  id: number;
  saleNumber: string;
  saleDate: string;
  customerName: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  deliveryProvider?: DeliveryProvider | null;
  deliveryTrackingId?: string | null;
  deliveryStatus?: DeliveryStatus | null;
  deliveryFee?: number;
  deliveryCost?: number;
}

export interface SaleDetail {
  id: number;
  saleId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export type HrPayrollPeriodStatus = 'DRAFT' | 'PROCESSING' | 'PROCESSED';

export interface HrEmployee {
  id: number;
  tenantId: string;
  code: string;
  name: string;
  position: string;
  baseSalary: number;
}

export interface HrAttendance {
  id: number;
  tenantId: string;
  employeeId: number;
  checkIn: string;
  checkOut?: string | null;
  hoursWorked: number;
  date: string;
}

export interface HrPayrollPeriod {
  id: number;
  tenantId: string;
  startDate: string;
  endDate: string;
  status: HrPayrollPeriodStatus;
  processedAt?: string | null;
}

export interface HrPayslip {
  id: number;
  tenantId: string;
  periodId: number;
  employeeId: number;
  basicPay: number;
  overtimePay: number;
  deductions: number;
  netPay: number;
  daysPresent: number;
  totalHours: number;
  overtimeHours: number;
}

export interface HrPayslipAggregate {
  employee: HrEmployee;
  payslip: HrPayslip;
  period: HrPayrollPeriod;
}

// ── Activation ───────────────────────────────────────────────────────────────

export interface ActivationState {
  isActivated: boolean;
  hardwareId: string;
  tenantId: string;
  companyName: string;
  email: string;
  activationKey: string;
  token: string;
  planType: string;
  features: string[];
  expiresAt: string | null;
  lastValidatedAt: string | null;
}

// ── Toast ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// ── Utility ──────────────────────────────────────────────────────────────────

/** Format a number as MMK currency string. */
export function formatMMK(amount: number): string {
  return new Intl.NumberFormat('en-MM', {
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Generate a unique ID. */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
