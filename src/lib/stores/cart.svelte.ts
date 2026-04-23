/**
 * Cart Store — manages POS shopping cart state.
 */
import type { CartItem, Product } from '$lib/types/index';
import { uid } from '$lib/types/index';

const TAX_RATE = 0.05; // Myanmar commercial tax 5%

class CartStore {
  items = $state<CartItem[]>([]);
  discountPercent = $state(0);

  get subtotal(): number {
    return this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  get itemDiscountTotal(): number {
    return this.items.reduce((sum, i) => sum + i.discount, 0);
  }

  get discountAmount(): number {
    return Math.round((this.subtotal - this.itemDiscountTotal) * (this.discountPercent / 100));
  }

  get taxableAmount(): number {
    return this.subtotal - this.itemDiscountTotal - this.discountAmount;
  }

  get taxAmount(): number {
    return Math.round(this.taxableAmount * TAX_RATE);
  }

  get total(): number {
    return this.taxableAmount + this.taxAmount;
  }

  get itemCount(): number {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Add a product to the cart (increments qty if already exists). */
  addProduct(product: Product) {
    const existing = this.items.find((i) => i.itemCode === product.itemCode);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.items.push({
        id: uid(),
        itemCode: product.itemCode,
        name: product.name,
        icon: product.icon,
        price: product.sellingPrice,
        quantity: 1,
        discount: 0,
      });
    }
  }

  removeItem(itemCode: string) {
    this.items = this.items.filter((i) => i.itemCode !== itemCode);
  }

  updateQuantity(itemCode: string, qty: number) {
    const item = this.items.find((i) => i.itemCode === itemCode);
    if (!item) return;
    if (qty <= 0) {
      this.removeItem(itemCode);
    } else {
      item.quantity = qty;
    }
  }

  incrementQty(itemCode: string) {
    const item = this.items.find((i) => i.itemCode === itemCode);
    if (item) item.quantity += 1;
  }

  decrementQty(itemCode: string) {
    const item = this.items.find((i) => i.itemCode === itemCode);
    if (!item) return;
    if (item.quantity <= 1) {
      this.removeItem(itemCode);
    } else {
      item.quantity -= 1;
    }
  }

  setDiscount(percent: number) {
    this.discountPercent = Math.max(0, Math.min(100, percent));
  }

  clear() {
    this.items = [];
    this.discountPercent = 0;
  }

  /** Snapshot the current cart for receipt/sale creation. */
  snapshot() {
    return {
      items: [...this.items],
      subtotal: this.subtotal,
      discountAmount: this.discountAmount,
      taxAmount: this.taxAmount,
      total: this.total,
      discountPercent: this.discountPercent,
    };
  }
}

export const cart = new CartStore();
