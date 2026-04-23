// @ts-check

import { writable } from 'svelte/store';
import { submitSaleWithOfflineFallback } from '$lib/syncManager';

/** @typedef {import('$lib/types/index').Product} Product */
/** @typedef {import('$lib/types/index').CartItem} CartItem */
/** @typedef {import('$lib/types/index').DeliverySelection} DeliverySelection */
/** @typedef {import('$lib/types/index').PaymentMethod} PaymentMethod */
/** @typedef {import('$lib/types/index').Sale} Sale */
/** @typedef {import('$lib/types/index').SaleDetail} SaleDetail */
/** @typedef {import('$lib/db').OfflineSalePayload} OfflineSalePayload */
/** @typedef {import('$lib/db').OfflineSaleStatus} OfflineSaleStatus */

const SERVICE_PREFIX = 'SERVICE-';

/**
 * @typedef CartState
 * @property {CartItem[]} items
 * @property {number} discount
 * @property {number} subtotal
 * @property {number} grandTotal
 */

/**
 * @typedef CheckoutOptions
 * @property {string} tenantId
 * @property {string} customerName
 * @property {PaymentMethod} paymentMethod
 * @property {number} [cashReceived]
 * @property {DeliverySelection | null} [deliverySelection]
 * @property {string} [cashierId]
 * @property {string} [registerId]
 * @property {'AVG' | 'FIFO'} [costingMethod]
 */

/**
 * @typedef CheckoutResult
 * @property {Sale} sale
 * @property {SaleDetail[]} details
 * @property {OfflineSaleStatus} syncStatus
 * @property {string | null} syncError
 * @property {number | null} queuedRecordId
 */

/** @returns {CartState} */
function createInitialState() {
  return {
    items: [],
    discount: 0,
    subtotal: 0,
    grandTotal: 0,
  };
}

/**
 * @param {CartState} state
 * @returns {CartState}
 */
function recalculate(state) {
  const subtotal = roundCurrency(
    state.items.reduce((sum, item) => sum + ((item.price * item.quantity) - item.discount), 0),
  );
  const discount = roundCurrency(Math.max(0, state.discount));

  return {
    ...state,
    subtotal,
    discount,
    grandTotal: roundCurrency(Math.max(0, subtotal - discount)),
  };
}

function createCartStore() {
  const { subscribe, update, set } = writable(createInitialState());
  /** @type {CartState} */
  let currentState = createInitialState();

  /**
   * @param {(state: CartState) => CartState} updater
   */
  function mutate(updater) {
    update((state) => {
      currentState = updater(state);
      return currentState;
    });
  }

  return {
    subscribe,

    /**
     * @param {Product} product
     * @param {number} [quantity]
     */
    addItem(product, quantity = 1) {
      mutate((state) => {
        const nextItems = [...state.items];
        const index = nextItems.findIndex((item) => item.itemCode === product.itemCode);

        if (index >= 0) {
          nextItems[index] = {
            ...nextItems[index],
            quantity: Math.max(1, nextItems[index].quantity + quantity),
          };
        } else {
          nextItems.push({
            id: product.id,
            itemCode: product.itemCode,
            name: product.name,
            icon: product.icon,
            price: product.sellingPrice,
            quantity: Math.max(1, quantity),
            discount: 0,
            kind: 'product',
            editableQuantity: true,
          });
        }

        return recalculate({
          ...state,
          items: nextItems,
        });
      });
    },

    /**
     * @param {string} itemCode
     * @param {number} quantity
     */
    updateQty(itemCode, quantity) {
      mutate((state) => {
        const nextItems = state.items
          .map((item) => {
            if (item.itemCode !== itemCode) {
              return item;
            }

            if (item.kind === 'service_charge') {
              return item;
            }

            return {
              ...item,
              quantity: Math.max(0, Math.floor(quantity)),
            };
          })
          .filter((item) => item.quantity > 0);

        return recalculate({
          ...state,
          items: nextItems,
        });
      });
    },

    /**
     * @param {number} amount
     */
    applyDiscount(amount) {
      mutate((state) =>
        recalculate({
          ...state,
          discount: Math.max(0, amount),
        }),
      );
    },

    /**
     * @param {string} itemCode
     */
    removeItem(itemCode) {
      mutate((state) =>
        recalculate({
          ...state,
          items: state.items.filter((item) => item.itemCode !== itemCode),
        }),
      );
    },

    /**
     * @param {string} code
     * @param {string} label
     * @param {number} amount
     * @param {Record<string, unknown>} [meta]
     */
    setServiceCharge(code, label, amount, meta = {}) {
      mutate((state) => {
        const itemCode = buildServiceItemCode(code);
        const nextItems = state.items.filter((item) => item.itemCode !== itemCode);

        if (amount > 0) {
          nextItems.push({
            id: itemCode,
            itemCode,
            name: label,
            icon: '',
            price: roundCurrency(amount),
            quantity: 1,
            discount: 0,
            kind: 'service_charge',
            editableQuantity: false,
            meta,
          });
        }

        return recalculate({
          ...state,
          items: nextItems,
        });
      });
    },

    /**
     * @param {string} code
     */
    removeServiceCharge(code) {
      mutate((state) =>
        recalculate({
          ...state,
          items: state.items.filter((item) => item.itemCode !== buildServiceItemCode(code)),
        }),
      );
    },

    /**
     * @param {OfflineSalePayload} payload
     */
    replaceFromOfflinePayload(payload) {
      const deliveryFee = roundCurrency(Number(payload.sale.delivery_fee ?? 0));
      const deliveryProvider = payload.sale.delivery_provider ?? 'MANUAL';
      /** @type {CartItem[]} */
      const items = payload.details.map((detail, index) => ({
        id: `${detail.item_code}-${index}`,
        itemCode: detail.item_code,
        name: detail.item_name,
        icon: '',
        price: roundCurrency(Number(detail.unit_price)),
        quantity: Math.max(1, Math.floor(Number(detail.quantity) || 1)),
        discount: roundCurrency(Number(detail.discount ?? 0)),
        kind: /** @type {const} */ ('product'),
        editableQuantity: true,
      }));

      if (deliveryFee > 0) {
        /** @type {CartItem} */
        const serviceCharge = {
          id: buildServiceItemCode('delivery'),
          itemCode: buildServiceItemCode('delivery'),
          name: `${deliveryProvider} delivery fee`,
          icon: '',
          price: deliveryFee,
          quantity: 1,
          discount: 0,
          kind: 'service_charge',
          editableQuantity: false,
          meta: {
            provider: deliveryProvider,
            fee: deliveryFee,
            currency: 'MMK',
            serviceType: 'DELIVERY',
            trackingId: payload.sale.delivery_tracking_id ?? null,
            status: payload.sale.delivery_status ?? null,
          },
        };

        items.push(serviceCharge);
      }

      currentState = recalculate({
        items,
        discount: roundCurrency(Number(payload.sale.discount_amount ?? 0)),
        subtotal: 0,
        grandTotal: 0,
      });
      set(currentState);
    },

    /**
     * @param {CheckoutOptions} options
     * @returns {Promise<CheckoutResult>}
     */
    async finalizeSale(options) {
      const productCartItems = currentState.items.filter((item) => item.kind !== 'service_charge');

      if (!productCartItems.length) {
        throw new Error('Cannot finalize an empty cart.');
      }

      const saleDate = new Date().toISOString();
      const saleNumber = buildSaleNumber(new Date(saleDate));
      const customerName = options.customerName.trim() || 'Walk-in Customer';
      const paymentMethod = options.paymentMethod;
      const cashReceived = Number(options.cashReceived ?? 0);
      const deliverySelection = options.deliverySelection ?? null;
      const sale = buildLocalSale({
        saleDate,
        saleNumber,
        customerName,
        paymentMethod,
        subtotal: currentState.subtotal,
        discount: currentState.discount,
        grandTotal: currentState.grandTotal,
        deliverySelection,
      });
      const details = productCartItems.map((item, index) => ({
        id: Date.now() + index,
        saleId: sale.id,
        itemCode: item.itemCode,
        itemName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        discount: item.discount,
        tax: 0,
        lineTotal: roundCurrency((item.price * item.quantity) - item.discount),
      }));
      const workerPayload = buildWorkerPayload({
        tenantId: options.tenantId,
        saleDate,
        saleNumber,
        customerName,
        paymentMethod,
        subtotal: currentState.subtotal,
        discount: currentState.discount,
        grandTotal: currentState.grandTotal,
        details,
        cashReceived,
        deliverySelection,
        cashierId: options.cashierId,
        registerId: options.registerId,
        costingMethod: options.costingMethod,
      });
      const syncResult = await submitSaleWithOfflineFallback({
        tenantId: options.tenantId,
        saleNumber,
        payload: workerPayload,
      });

      return {
        sale,
        details,
        syncStatus: syncResult.status,
        syncError: syncResult.error,
        queuedRecordId: syncResult.record?.id ?? null,
      };
    },

    clear() {
      currentState = createInitialState();
      set(currentState);
    },
  };
}

/**
 * @param {{
 *   saleDate: string;
 *   saleNumber: string;
 *   customerName: string;
 *   paymentMethod: PaymentMethod;
 *   subtotal: number;
 *   discount: number;
 *   grandTotal: number;
 *   deliverySelection: DeliverySelection | null;
 * }} input
 * @returns {Sale}
 */
function buildLocalSale(input) {
  return {
    id: Date.now(),
    saleNumber: input.saleNumber,
    saleDate: input.saleDate,
    customerName: input.customerName,
    totalAmount: input.subtotal,
    taxAmount: 0,
    discountAmount: input.discount,
    netAmount: input.grandTotal,
    paymentMethod: input.paymentMethod,
    status: 'COMPLETED',
    deliveryProvider: input.deliverySelection?.provider ?? null,
    deliveryTrackingId: input.deliverySelection?.trackingId ?? null,
    deliveryStatus: input.deliverySelection?.status ?? (input.deliverySelection ? 'QUOTE' : null),
    deliveryFee: input.deliverySelection?.fee ?? 0,
    deliveryCost: input.deliverySelection?.fee ?? 0,
  };
}

/**
 * @param {{
 *   tenantId: string;
 *   saleDate: string;
 *   saleNumber: string;
 *   customerName: string;
 *   paymentMethod: PaymentMethod;
 *   subtotal: number;
 *   discount: number;
 *   grandTotal: number;
 *   details: SaleDetail[];
 *   cashReceived: number;
 *   deliverySelection: DeliverySelection | null;
 *   cashierId?: string;
 *   registerId?: string;
 *   costingMethod?: 'AVG' | 'FIFO';
 * }} input
 * @returns {OfflineSalePayload}
 */
function buildWorkerPayload(input) {
  return {
    sale: {
      tenant_id: input.tenantId,
      invoice_no: input.saleNumber,
      sale_number: input.saleNumber,
      sale_date: input.saleDate,
      customer_name: input.customerName,
      total_amount: roundCurrency(input.subtotal),
      tax_amount: 0,
      discount_amount: roundCurrency(input.discount),
      net_amount: roundCurrency(input.grandTotal),
      payment_method: input.paymentMethod,
      status: 'COMPLETED',
      cashier_id: input.cashierId ?? 'WEB-POS',
      register_id: input.registerId ?? 'TERMINAL-1',
      delivery_provider: input.deliverySelection?.provider ?? null,
      delivery_tracking_id: input.deliverySelection?.trackingId ?? null,
      delivery_status: input.deliverySelection?.status ?? (input.deliverySelection ? 'QUOTE' : null),
      delivery_fee: roundCurrency(input.deliverySelection?.fee ?? 0),
      delivery_cost: roundCurrency(input.deliverySelection?.fee ?? 0),
      amount_paid: input.paymentMethod === 'CREDIT' ? 0 : roundCurrency(input.cashReceived || input.grandTotal),
      costing_method: input.costingMethod ?? 'AVG',
    },
    details: input.details.map((detail) => ({
      item_code: detail.itemCode,
      item_name: detail.itemName,
      location_code: 'MAIN',
      quantity: detail.quantity,
      unit_price: roundCurrency(detail.unitPrice),
      discount: roundCurrency(detail.discount),
      tax: roundCurrency(detail.tax),
      line_total: roundCurrency(detail.lineTotal),
    })),
  };
}

/**
 * @param {number} value
 * @returns {number}
 */
function roundCurrency(value) {
  return Number(value.toFixed(2));
}

/**
 * @param {Date} now
 * @returns {string}
 */
function buildSaleNumber(now) {
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0',
  )}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
  const entropy = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `POS-${datePart}-${timePart}-${entropy}`;
}

/**
 * @param {string} code
 * @returns {string}
 */
function buildServiceItemCode(code) {
  return `${SERVICE_PREFIX}${code.trim().toUpperCase()}`;
}

export const cartStore = createCartStore();
