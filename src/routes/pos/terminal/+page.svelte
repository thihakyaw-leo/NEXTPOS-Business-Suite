<svelte:options runes={false} />

<script lang="ts">
  import { tick } from 'svelte';
  import DeliveryModal from '$lib/components/DeliveryModal.svelte';
  import type { OfflineSaleRecord } from '$lib/db';
  import { resolveTenantId } from '$lib/api/tenant';
  import {
    deleteOfflineSale,
    retryOfflineSale,
    syncPendingSales,
    syncState,
  } from '$lib/syncManager';
  import { auth } from '$lib/stores/auth.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { sales } from '$lib/stores/sales.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { cartStore } from '$lib/stores/cartStore.js';
  import { featureStore, roleStore } from '$lib/stores/featureStore.js';
  import { printReceipt } from '$lib/platform';
  import type {
    DeliverySelection,
    PaymentMethod,
    Product,
    ProductCategory,
    Sale,
    SaleDetail,
  } from '$lib/types/index';
  import { formatMMK } from '$lib/types/index';

  type TerminalCategory = ProductCategory | 'all';
  type CheckoutMethod = Extract<PaymentMethod, 'CASH' | 'CREDIT'>;
  type ReviewAction = 'edit' | 'delete' | 'void';

  const navItems = [
    { href: '/pos/dashboard', label: 'Dashboard', meta: 'Owner overview' },
    { href: '/pos/terminal', label: 'Terminal', meta: 'Touch checkout' },
    { href: '/pos/inventory', label: 'Inventory', meta: 'Stock room' },
  ];
  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['00', '0', '⌫'],
  ];

  const scanGapMs = 75;
  const minBarcodeLength = 6;
  const deliveryServiceCode = 'delivery';

  let searchQuery = '';
  let activeCategory: TerminalCategory = 'all';
  let selectedItemCode: string | null = null;
  let keypadBuffer = '';
  let barcodeBuffer = '';
  let lastKeyTime = 0;
  let paymentMethod: CheckoutMethod = 'CASH';
  let paymentOpen = false;
  let cashReceived = '';
  let creditCustomer = '';
  let copiedReceipt = '';
  let checkoutError = '';
  let deliveryOpen = false;
  let deliverySelection: DeliverySelection | null = null;
  let activeConflict: OfflineSaleRecord | null = null;
  let pendingReviewAction: { type: ReviewAction; conflict: OfflineSaleRecord } | null = null;
  let reviewBusyId: number | null = null;
  let editingConflict: OfflineSaleRecord | null = null;
  let printReceiptToggle = false;

  $: filteredProducts = products.all.filter((product) => {
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      product.name.toLowerCase().includes(query) ||
      (product.nameMy?.toLowerCase().includes(query) ?? false) ||
      product.itemCode.toLowerCase().includes(query) ||
      product.barcode.includes(query);

    return matchesCategory && matchesQuery;
  });
  $: cartState = $cartStore;
  $: cartItems = cartState.items;
  $: productCartItems = cartItems.filter((item) => item.kind !== 'service_charge');
  $: serviceChargeItems = cartItems.filter((item) => item.kind === 'service_charge');
  $: grandTotal = cartState.grandTotal;
  $: subtotal = cartState.subtotal;
  $: discount = cartState.discount;
  $: serviceChargeTotal = serviceChargeItems.reduce(
    (sum, item) => sum + ((item.price * item.quantity) - item.discount),
    0,
  );
  $: merchandiseSubtotal = toCurrency(subtotal - serviceChargeTotal);
  $: lineCount = productCartItems.reduce((sum, item) => sum + item.quantity, 0);
  $: selectedCartItem = selectedItemCode
    ? productCartItems.find((item) => item.itemCode === selectedItemCode) ?? null
    : null;
  $: projectedChange =
    paymentMethod === 'CASH'
      ? Math.max(0, toCurrency(Number(cashReceived || 0) - grandTotal))
      : 0;

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (barcodeBuffer.length >= minBarcodeLength) {
        void resolveBarcode(barcodeBuffer);
        event.preventDefault();
      }

      barcodeBuffer = '';
      lastKeyTime = 0;
      return;
    }

    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const now = performance.now();
    if (now - lastKeyTime > scanGapMs) {
      barcodeBuffer = '';
    }

    lastKeyTime = now;
    barcodeBuffer += event.key;
  }

  async function resolveBarcode(barcode: string) {
    const product = products.getByBarcode(barcode);

    if (!product) {
      ui.warning(`Barcode ${barcode} not found`);
      return;
    }

    cartStore.addItem(product);
    selectedItemCode = product.itemCode;
    await tick();
    syncSelectedQuantity();
    ui.success(`${product.name} added to cart`);
  }

  async function addProduct(product: Product) {
    cartStore.addItem(product);
    selectedItemCode = product.itemCode;
    await tick();
    syncSelectedQuantity();
  }

  function selectItem(itemCode: string) {
    selectedItemCode = itemCode;
    syncSelectedQuantity();
  }

  function syncSelectedQuantity() {
    const item = selectedItemCode
      ? productCartItems.find((entry) => entry.itemCode === selectedItemCode) ?? null
      : null;

    keypadBuffer = item ? String(item.quantity) : '';
  }

  function applyQuickDiscount(amount: number) {
    cartStore.applyDiscount(amount);
  }

  function clearCart() {
    cartStore.clear();
    selectedItemCode = null;
    keypadBuffer = '';
    deliverySelection = null;
    editingConflict = null;
    copiedReceipt = '';
    checkoutError = '';
    paymentOpen = false;
  }

  function removeCartItem(itemCode: string) {
    cartStore.removeItem(itemCode);

    if (itemCode === buildServiceChargeCode(deliveryServiceCode)) {
      deliverySelection = null;
    }

    if (selectedItemCode === itemCode) {
      selectedItemCode = null;
      keypadBuffer = '';
    }
  }

  function handleDiscountChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    cartStore.applyDiscount(Number(target.value || 0));
  }

  function handleKeypadPress(value: string) {
    if (paymentOpen && paymentMethod === 'CASH') {
      cashReceived = updateNumericValue(cashReceived, value);
      checkoutError = '';
      return;
    }

    if (!selectedItemCode) {
      return;
    }

    keypadBuffer = updateNumericValue(keypadBuffer, value);

    if (!keypadBuffer) {
      cartStore.updateQty(selectedItemCode, 0);
      selectedItemCode = null;
      return;
    }

    const nextQty = Number(keypadBuffer);
    cartStore.updateQty(selectedItemCode, nextQty);
  }

  function openDeliveryModal() {
    if (!productCartItems.length) {
      ui.warning('Add at least one product before requesting delivery');
      return;
    }

    deliveryOpen = true;
  }

  function closeDeliveryModal() {
    deliveryOpen = false;
  }

  function handleDeliveryApplied(event: CustomEvent<{ selection: DeliverySelection }>) {
    deliverySelection = event.detail.selection;
    cartStore.setServiceCharge(
      deliveryServiceCode,
      `${event.detail.selection.provider} delivery fee`,
      event.detail.selection.fee,
      event.detail.selection as unknown as Record<string, unknown>,
    );
    deliveryOpen = false;
    ui.success(`${event.detail.selection.provider} delivery fee added to cart`);
  }

  function clearDeliverySelection() {
    deliverySelection = null;
    cartStore.removeServiceCharge(deliveryServiceCode);
  }

  function openPaymentModal() {
    if (!productCartItems.length) {
      ui.warning('Add at least one item before checkout');
      return;
    }

    paymentOpen = true;
    paymentMethod = 'CASH';
    cashReceived = String(grandTotal);
    creditCustomer = '';
    checkoutError = '';
  }

  function closePaymentModal() {
    paymentOpen = false;
    checkoutError = '';
  }

  function setPaymentOption(option: CheckoutMethod) {
    paymentMethod = option;
    checkoutError = '';
  }

  async function confirmCheckout() {
    if (!productCartItems.length) {
      checkoutError = 'Cart is empty';
      return;
    }

    if (paymentMethod === 'CASH' && Number(cashReceived || 0) < grandTotal) {
      checkoutError = 'Cash received must cover the grand total';
      return;
    }

    if (paymentMethod === 'CREDIT' && !creditCustomer.trim()) {
      checkoutError = 'Customer name is required for credit sales';
      return;
    }

    const customerName = paymentMethod === 'CREDIT' ? creditCustomer.trim() : 'Walk-in Customer';
    const tenantId = resolveTenantId(auth.activation.tenantId);

    if (!tenantId) {
      checkoutError = 'Tenant ID is required before checkout';
      return;
    }

    try {
      const replacementTarget = editingConflict;
      const result = await cartStore.finalizeSale({
        tenantId,
        customerName,
        paymentMethod,
        cashReceived: paymentMethod === 'CASH' ? Number(cashReceived || 0) : 0,
        deliverySelection,
      });
      const { sale, details, syncStatus, syncError } = result;

      if (replacementTarget) {
        rollbackConflictSaleLocally(replacementTarget, 'delete');
      }

      sales.addSale(sale, details);
      for (const item of productCartItems) {
        products.decreaseStock(item.itemCode, item.quantity);
      }

      if (replacementTarget?.id) {
        try {
          await deleteOfflineSale(replacementTarget.id);
        } catch (error) {
          ui.warning(
            error instanceof Error
              ? error.message
              : 'Replacement sale was saved, but the original conflict still needs manual cleanup.',
          );
        }
      }

      const invoice = formatInvoice(sale, details, {
        cashReceived: paymentMethod === 'CASH' ? Number(cashReceived || 0) : 0,
        change: projectedChange,
      });

      if (printReceiptToggle) {
        await printReceipt(invoice);
      } else {
        await copyText(invoice);
      }

      copiedReceipt = invoice;
      cartStore.clear();
      selectedItemCode = null;
      keypadBuffer = '';
      paymentOpen = false;
      checkoutError = '';
      deliverySelection = null;
      editingConflict = null;
      activeConflict = null;
      pendingReviewAction = null;

      const successActionStr = printReceiptToggle ? 'Receipt printed.' : 'Invoice copied to clipboard.';

      if (syncStatus === 'SYNCED') {
        ui.success(`Checkout complete. ${successActionStr}`);
      } else if (syncStatus === 'PENDING') {
        ui.success(`Sale saved offline and queued for sync. ${successActionStr}`);
      } else {
        ui.success(
          replacementTarget
            ? 'Edited sale saved locally. Manager review is still required before sync.'
            : 'Sale saved locally. Manager review is required before sync.',
        );
      }

      if (syncError) {
        ui.warning(syncError);
      }
    } catch (error) {
      checkoutError = error instanceof Error ? error.message : 'Checkout could not be completed';
    }
  }

  function openConflictDetails(conflict: OfflineSaleRecord) {
    activeConflict = conflict;
  }

  function closeConflictDetails() {
    activeConflict = null;
  }

  function requestConflictAction(type: ReviewAction, conflict: OfflineSaleRecord) {
    pendingReviewAction = { type, conflict };
  }

  function closeConflictAction() {
    pendingReviewAction = null;
  }

  async function handleRetry(conflict: OfflineSaleRecord) {
    if (!conflict.id || reviewBusyId === conflict.id) {
      return;
    }

    reviewBusyId = conflict.id;

    try {
      await retryOfflineSale(conflict.id);
      ui.info(`${conflict.saleNumber} moved back to the sync queue.`);
    } catch (error) {
      ui.error(error instanceof Error ? error.message : 'Retry could not be started.');
    } finally {
      reviewBusyId = null;
    }
  }

  async function confirmConflictAction() {
    const conflictId = pendingReviewAction?.conflict.id ?? null;

    if (!pendingReviewAction || !conflictId || reviewBusyId === conflictId) {
      return;
    }

    const { type, conflict } = pendingReviewAction;
    reviewBusyId = conflictId;

    try {
      if (type === 'edit') {
        await loadConflictIntoCart(conflict);
      } else {
        await deleteOfflineSale(conflictId);
        rollbackConflictSaleLocally(conflict, type);

        if (editingConflict?.id === conflict.id) {
          clearCart();
        }

        if (activeConflict?.id === conflict.id) {
          activeConflict = null;
        }

        ui.success(
          type === 'void'
            ? `${conflict.saleNumber} was voided and removed from the sync queue.`
            : `${conflict.saleNumber} was removed from the sync queue.`,
        );
      }

      pendingReviewAction = null;
    } catch (error) {
      ui.error(error instanceof Error ? error.message : 'Manager review action could not be completed.');
    } finally {
      reviewBusyId = null;
    }
  }

  async function loadConflictIntoCart(conflict: OfflineSaleRecord) {
    paymentOpen = false;
    deliveryOpen = false;
    checkoutError = '';
    copiedReceipt = '';
    paymentMethod = toCheckoutMethod(conflict.payload.sale.payment_method);
    cashReceived = String(conflict.payload.sale.amount_paid ?? conflict.payload.sale.net_amount);
    creditCustomer = conflict.payload.sale.customer_name?.trim() ?? '';
    deliverySelection = buildDeliverySelection(conflict);
    cartStore.replaceFromOfflinePayload(conflict.payload);
    editingConflict = conflict;
    selectedItemCode = conflict.payload.details[0]?.item_code ?? null;
    activeConflict = null;

    await tick();
    syncSelectedQuantity();
    ui.info(
      `${conflict.saleNumber} loaded into the cart. Confirm checkout to replace the original conflict.`,
    );
  }

  function cancelConflictEdit() {
    clearCart();
    cashReceived = '';
    creditCustomer = '';
    ui.info('Conflict edit mode canceled.');
  }

  function rollbackConflictSaleLocally(
    conflict: OfflineSaleRecord,
    resolution: Exclude<ReviewAction, 'edit'>,
  ) {
    const existingSale = sales.findBySaleNumber(conflict.saleNumber);

    if (existingSale?.status === 'COMPLETED') {
      for (const detail of conflict.payload.details) {
        products.increaseStock(detail.item_code, detail.quantity);
      }
    }

    if (resolution === 'void') {
      if (existingSale) {
        sales.voidSale(conflict.saleNumber);
      }
      return;
    }

    if (existingSale) {
      sales.deleteSale(conflict.saleNumber);
    }
  }

  function buildDeliverySelection(conflict: OfflineSaleRecord): DeliverySelection | null {
    const sale = conflict.payload.sale;
    const deliveryFee = Number(sale.delivery_fee ?? 0);

    if (!sale.delivery_provider && deliveryFee <= 0) {
      return null;
    }

    return {
      provider: sale.delivery_provider ?? 'MANUAL',
      fee: deliveryFee,
      currency: 'MMK',
      serviceType: 'DELIVERY',
      quoteId: null,
      trackingId: sale.delivery_tracking_id ?? null,
      status: sale.delivery_status ?? null,
    };
  }

  function toCheckoutMethod(method: PaymentMethod): CheckoutMethod {
    return method === 'CREDIT' ? 'CREDIT' : 'CASH';
  }

  function isConflictBeingEdited(conflict: OfflineSaleRecord): boolean {
    return Boolean(editingConflict?.id && editingConflict.id === conflict.id);
  }

  function reviewActionTitle(type: ReviewAction): string {
    if (type === 'edit') {
      return 'Load Conflict Into Cart';
    }

    if (type === 'void') {
      return 'Void Conflicted Sale';
    }

    return 'Delete Conflicted Sale';
  }

  function reviewActionDescription(action: { type: ReviewAction; conflict: OfflineSaleRecord }): string {
    if (action.type === 'edit') {
      return cartItems.length
        ? 'This will replace the current cart with the conflicted sale so you can correct it and checkout again.'
        : 'This will load the conflicted sale into the cart so you can correct it and checkout again.';
    }

    if (action.type === 'void') {
      return 'This will remove the conflict from the sync queue and mark the local sale as voided when it exists in the current session.';
    }

    return 'This will remove the conflict from the sync queue and delete the local sale when it exists in the current session.';
  }

  function reviewActionConfirmLabel(type: ReviewAction): string {
    if (type === 'edit') {
      return 'Load Into Cart';
    }

    if (type === 'void') {
      return 'Void Sale';
    }

    return 'Delete Sale';
  }

  function formatConflictTimestamp(value?: string | null): string {
    if (!value) {
      return 'Not recorded';
    }

    return new Date(value).toLocaleString('en-MM');
  }

  function formatInvoice(
    sale: Sale,
    details: SaleDetail[],
    summary: { cashReceived: number; change: number },
  ): string {
    const lines = [
      'NEXTPOS RETAIL TERMINAL',
      '------------------------------',
      `Invoice : ${sale.saleNumber}`,
      `Date    : ${new Date(sale.saleDate).toLocaleString('en-MM')}`,
      `Customer: ${sale.customerName}`,
      `Payment : ${sale.paymentMethod}`,
      sale.deliveryProvider ? `Delivery: ${sale.deliveryProvider}` : null,
      '------------------------------',
      ...details.map((detail) => {
        const total = formatMMK(detail.lineTotal);
        return `${detail.itemName}\n  ${detail.quantity} x ${formatMMK(detail.unitPrice)} = ${total}`;
      }),
      sale.deliveryFee
        ? `Delivery Fee: ${formatMMK(sale.deliveryFee)} MMK`
        : null,
      '------------------------------',
      `Subtotal: ${formatMMK(sale.totalAmount)} MMK`,
      `Discount: ${formatMMK(sale.discountAmount)} MMK`,
      `Grand   : ${formatMMK(sale.netAmount)} MMK`,
      sale.paymentMethod === 'CASH'
        ? `Cash In : ${formatMMK(summary.cashReceived)} MMK`
        : 'Cash In : CREDIT',
      sale.paymentMethod === 'CASH'
        ? `Change  : ${formatMMK(summary.change)} MMK`
        : 'Balance : To be collected',
      '------------------------------',
      'Thank you for shopping with us.',
    ].filter((line): line is string => Boolean(line));

    return lines.join('\n');
  }

  async function copyText(value: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    if (typeof document === 'undefined') {
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function updateNumericValue(currentValue: string, key: string): string {
    if (key === '⌫') {
      return currentValue.slice(0, -1);
    }

    const nextValue = `${currentValue}${key}`;
    return nextValue.replace(/^0+(?=\d)/, '');
  }

  function toCurrency(value: number): number {
    return Number(value.toFixed(2));
  }

  function buildServiceChargeCode(code: string): string {
    return `SERVICE-${code.trim().toUpperCase()}`;
  }
</script>

<svelte:head>
  <title>NextPOS Terminal</title>
</svelte:head>

<svelte:body on:keydown={handleGlobalKeydown} />

<div class="min-h-screen ink-grid">
  <div class="grid min-h-screen lg:grid-cols-[18rem,1fr]">
    <aside class="border-b border-white/10 bg-slate-950/65 px-5 py-6 backdrop-blur-2xl lg:border-b-0 lg:border-r">
      <div class="panel-surface p-5">
        <p class="text-xs uppercase tracking-[0.35em] text-orange-200/80">Checkout Lane</p>
        <h1 class="mt-3 text-2xl font-bold text-white">{auth.companyName}</h1>
        <p class="mt-2 text-sm text-slate-300">Touch-first terminal with barcode capture, fast quantity edits, and clipboard invoice output.</p>
      </div>

      <nav class="mt-6 space-y-3">
        {#each navItems as item}
          <a
            href={item.href}
            class={`block rounded-[1.4rem] border px-4 py-3 transition ${
              item.href === '/pos/terminal'
                ? 'border-orange-400/30 bg-orange-400/15 text-white shadow-[0_0_0_1px_rgba(251,146,60,0.18)]'
                : 'border-white/8 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.06]'
            }`}
          >
            <span class="block text-sm font-semibold">{item.label}</span>
            <span class="mt-1 block text-xs text-slate-400">{item.meta}</span>
          </a>
        {/each}

        {#if $featureStore.includes('hr_payroll')}
          <a
            href="/hr/payroll"
            class="block rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-slate-300 transition hover:border-white/15 hover:bg-white/[0.06]"
          >
            <span class="block text-sm font-semibold">HR</span>
            <span class="mt-1 block text-xs text-slate-400">Visible only when hr_payroll is enabled</span>
          </a>
        {/if}
      </nav>

      <div class="panel-muted mt-6 p-4">
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Station</p>
        <div class="mt-4 space-y-3 text-sm text-slate-300">
          <div class="flex items-center justify-between">
            <span>Role</span>
            <strong class="text-white">{$roleStore}</strong>
          </div>
          <div class="flex items-center justify-between">
            <span>Items in cart</span>
            <strong class="text-white">{lineCount}</strong>
          </div>
          <div class="flex items-center justify-between">
            <span>Barcode buffer</span>
            <strong class="max-w-28 truncate text-white">{barcodeBuffer || 'Idle'}</strong>
          </div>
        </div>
      </div>

      <div class="panel-muted mt-6 p-4">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Offline Sync</p>
          <span
            class={`rounded-full px-3 py-1 text-xs font-semibold ${
              $syncState.online
                ? 'bg-emerald-400/12 text-emerald-200'
                : 'bg-amber-400/12 text-amber-200'
            }`}
          >
            {$syncState.online ? 'Online' : 'Offline'}
          </span>
        </div>

        <div class="mt-4 space-y-3 text-sm text-slate-300">
          <div class="flex items-center justify-between">
            <span>Pending queue</span>
            <strong class="text-white">{$syncState.pendingCount}</strong>
          </div>
          <div class="flex items-center justify-between">
            <span>Conflicts</span>
            <strong class="text-white">{$syncState.conflictCount}</strong>
          </div>
        </div>

        <button
          class="touch-button mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]"
          disabled={$syncState.syncing || !$syncState.pendingCount}
          on:click={() => void syncPendingSales()}
        >
          {$syncState.syncing ? 'Syncing...' : 'Sync Pending Sales'}
        </button>

        {#if $syncState.conflicts.length}
          <div class="mt-4 space-y-3">
            <p class="text-xs uppercase tracking-[0.22em] text-rose-200/80">Manager Review</p>
            {#each $syncState.conflicts as conflict (conflict.id)}
              <article class="rounded-[1.2rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-slate-100">
                <div class="flex items-start justify-between gap-3">
                  <p class="font-semibold text-white">{conflict.saleNumber}</p>
                  {#if isConflictBeingEdited(conflict)}
                    <span class="rounded-full border border-amber-300/25 bg-amber-400/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                      Editing
                    </span>
                  {/if}
                </div>
                <p class="mt-1 text-xs text-slate-300">
                  {conflict.payload.sale.customer_name || 'Walk-in Customer'} - {formatMMK(conflict.payload.sale.net_amount)} MMK
                </p>
                <p class="mt-2 text-xs text-rose-100">
                  {conflict.lastError ?? 'Sync conflict detected.'}
                </p>
                <div class="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                  <span class="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1">
                    {conflict.errorKind ?? conflict.conflictDetails?.kind ?? 'UNKNOWN'}
                  </span>
                  <span class="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1">
                    Attempt {Math.max(1, conflict.retryCount)}
                  </span>
                  <span class="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1">
                    {conflict.lastHttpStatus ? `HTTP ${conflict.lastHttpStatus}` : 'Offline review'}
                  </span>
                </div>

                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    class="touch-button rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-xs text-white hover:bg-white/[0.12]"
                    on:click={() => openConflictDetails(conflict)}
                  >
                    Open Details
                  </button>
                  <button
                    class="touch-button rounded-2xl border border-teal-300/20 bg-teal-400/10 px-3 text-xs text-teal-100 hover:bg-teal-400/20"
                    on:click={() => requestConflictAction('edit', conflict)}
                  >
                    {isConflictBeingEdited(conflict) ? 'Loaded In Cart' : 'Edit In Cart'}
                  </button>
                  <button
                    class="touch-button rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-xs text-white hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!conflict.id || reviewBusyId === conflict.id || isConflictBeingEdited(conflict)}
                    on:click={() => void handleRetry(conflict)}
                  >
                    {reviewBusyId === conflict.id ? 'Working...' : 'Retry Sync'}
                  </button>
                  <button
                    class="touch-button rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 text-xs text-amber-100 hover:bg-amber-400/18 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!conflict.id || reviewBusyId === conflict.id || isConflictBeingEdited(conflict)}
                    on:click={() => requestConflictAction('void', conflict)}
                  >
                    Void Sale
                  </button>
                  <button
                    class="touch-button sm:col-span-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 text-xs text-rose-100 hover:bg-rose-400/18 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!conflict.id || reviewBusyId === conflict.id || isConflictBeingEdited(conflict)}
                    on:click={() => requestConflictAction('delete', conflict)}
                  >
                    Delete Sale
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </div>
    </aside>

    <main class="overflow-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div class="grid h-full gap-6 xl:grid-cols-[1.4fr,0.95fr]">
        <section class="panel-surface flex min-h-[70vh] flex-col overflow-hidden">
          <div class="border-b border-white/8 px-5 py-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p class="text-xs uppercase tracking-[0.35em] text-teal-300/80">Product Grid</p>
                <h2 class="mt-2 text-2xl font-bold text-white">Fast checkout selection</h2>
              </div>
              <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr),auto]">
                <input
                  bind:value={searchQuery}
                  class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500"
                  type="search"
                  placeholder="Search by name, code, or barcode"
                />
                <a
                  href="/pos/dashboard"
                  class="touch-button inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]"
                >
                  View Dashboard
                </a>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button
                class={`touch-button rounded-full px-4 ${
                  activeCategory === 'all'
                    ? 'bg-teal-400 text-slate-950'
                    : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
                }`}
                on:click={() => (activeCategory = 'all')}
              >
                All
              </button>
              {#each products.categories as category}
                <button
                  class={`touch-button rounded-full px-4 ${
                    activeCategory === category
                      ? 'bg-teal-400 text-slate-950'
                      : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
                  }`}
                  on:click={() => (activeCategory = category)}
                >
                  {category}
                </button>
              {/each}
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-5">
            <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {#each filteredProducts as product}
                <button
                  class="panel-muted group flex min-h-44 flex-col justify-between p-4 text-left hover:border-white/15 hover:bg-white/[0.08]"
                  on:click={() => void addProduct(product)}
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-lg font-semibold text-white">{product.name}</p>
                      <p class="mt-1 text-sm text-slate-400">{product.nameMy}</p>
                    </div>
                    <span class="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                      {product.unit}
                    </span>
                  </div>

                  <div>
                    <div class="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                      <span>{product.itemCode}</span>
                      <span>{product.barcode}</span>
                    </div>
                    <div class="mt-4 flex items-end justify-between">
                      <div>
                        <p class="text-2xl font-bold text-teal-200">{formatMMK(product.sellingPrice)} MMK</p>
                        <p class="mt-1 text-sm text-slate-400">Stock {product.stock}</p>
                      </div>
                      <span class="rounded-2xl bg-orange-400/12 px-3 py-2 text-xs font-semibold text-orange-100">
                        Add
                      </span>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        </section>

        <section class="panel-surface flex min-h-[70vh] flex-col overflow-hidden">
          <div class="border-b border-white/8 px-5 py-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs uppercase tracking-[0.35em] text-orange-200/80">Cart & Numpad</p>
                <h2 class="mt-2 text-2xl font-bold text-white">Active basket</h2>
              </div>
              <button
                class="touch-button rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]"
                on:click={clearCart}
              >
                Clear Cart
              </button>
            </div>
          </div>

          <div class="grid flex-1 gap-5 overflow-hidden p-5 xl:grid-rows-[1fr,auto]">
            <div class="grid gap-5 overflow-hidden">
              {#if editingConflict}
                <div class="rounded-[1.4rem] border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p class="text-xs uppercase tracking-[0.25em] text-amber-100/80">Editing Conflict</p>
                      <p class="mt-2 text-base font-semibold text-white">{editingConflict.saleNumber}</p>
                      <p class="mt-2 max-w-2xl text-sm text-amber-50/85">
                        This cart is replacing the original conflicted sale. Confirm checkout to submit the corrected version and clear the old manager-review item.
                      </p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button
                        class="touch-button rounded-2xl border border-white/10 bg-white/[0.08] px-3 text-xs text-white hover:bg-white/[0.14]"
                        on:click={() => {
                          if (editingConflict) {
                            openConflictDetails(editingConflict);
                          }
                        }}
                      >
                        Open Details
                      </button>
                      <button
                        class="touch-button rounded-2xl border border-amber-200/20 bg-amber-300/10 px-3 text-xs text-amber-50 hover:bg-amber-300/16"
                        on:click={cancelConflictEdit}
                      >
                        Cancel Edit
                      </button>
                    </div>
                  </div>
                </div>
              {/if}

              <div class="panel-muted min-h-0 overflow-y-auto p-4">
                <div class="space-y-3">
                  {#if cartItems.length}
                    {#each cartItems as item}
                      <article
                        class={`rounded-[1.3rem] border px-4 py-3 transition ${
                          item.kind === 'service_charge'
                            ? 'border-sky-400/20 bg-sky-400/10'
                            : selectedItemCode === item.itemCode
                            ? 'border-orange-400/35 bg-orange-400/12'
                            : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div class="flex items-start justify-between gap-3">
                          {#if item.kind === 'service_charge'}
                            <div class="flex-1 text-left">
                              <p class="font-semibold text-white">{item.name}</p>
                              <p class="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Service Charge</p>
                            </div>
                          {:else}
                            <button class="flex-1 text-left" on:click={() => selectItem(item.itemCode)}>
                              <p class="font-semibold text-white">{item.name}</p>
                              <p class="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{item.itemCode}</p>
                            </button>
                          {/if}
                          <button
                            class="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200"
                            on:click={() => removeCartItem(item.itemCode)}
                          >
                            Remove
                          </button>
                        </div>
                        {#if item.kind === 'service_charge'}
                          <div class="mt-4 flex w-full items-center justify-between text-sm text-slate-300">
                            <span>Applied at checkout</span>
                            <strong class="text-white">{formatMMK(item.price * item.quantity - item.discount)} MMK</strong>
                          </div>
                        {:else}
                          <button class="mt-4 flex w-full items-center justify-between text-left text-sm text-slate-300" on:click={() => selectItem(item.itemCode)}>
                            <span>{item.quantity} x {formatMMK(item.price)} MMK</span>
                            <strong class="text-white">{formatMMK(item.price * item.quantity - item.discount)} MMK</strong>
                          </button>
                        {/if}
                      </article>
                    {/each}
                  {:else}
                    <div class="flex h-full min-h-60 items-center justify-center rounded-[1.3rem] border border-dashed border-white/12 text-center text-sm text-slate-500">
                      Scan a barcode or tap a product tile to start the cart.
                    </div>
                  {/if}
                </div>
              </div>

              <div class="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
                <div class="panel-muted p-4">
                  <div class="flex items-end justify-between">
                    <div>
                      <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Cart Summary</p>
                      <p class="mt-2 text-3xl font-bold text-white">{formatMMK(grandTotal)} MMK</p>
                    </div>
                    <span class="rounded-full bg-teal-400/15 px-3 py-1 text-xs font-semibold text-teal-200">
                      {lineCount} pcs
                    </span>
                  </div>

                  <div class="mt-4 grid gap-3 text-sm text-slate-300">
                    <div class="flex items-center justify-between">
                      <span>Merchandise</span>
                      <strong class="text-white">{formatMMK(merchandiseSubtotal)} MMK</strong>
                    </div>
                    <div class="flex items-center justify-between">
                      <span>Discount</span>
                      <strong class="text-white">{formatMMK(discount)} MMK</strong>
                    </div>
                    <div class="flex items-center justify-between">
                      <span>Delivery</span>
                      <strong class="text-white">{formatMMK(serviceChargeTotal)} MMK</strong>
                    </div>
                    <div class="flex items-center justify-between">
                      <span>Subtotal</span>
                      <strong class="text-white">{formatMMK(subtotal)} MMK</strong>
                    </div>
                  </div>

                  {#if deliverySelection}
                    <div class="mt-5 rounded-[1.2rem] border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-slate-100">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <p class="font-semibold">{deliverySelection.provider} delivery selected</p>
                          <p class="mt-1 text-xs text-slate-300">{deliverySelection.dropoffAddress}</p>
                        </div>
                        <button
                          class="touch-button rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-xs text-slate-100 hover:bg-white/[0.1]"
                          on:click={clearDeliverySelection}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  {/if}

                  <div class="mt-5 space-y-3">
                    <label class="text-xs uppercase tracking-[0.22em] text-slate-400" for="discount">Discount</label>
                    <input
                      id="discount"
                      class="touch-button w-full rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
                      type="number"
                      min="0"
                      value={discount}
                      on:change={handleDiscountChange}
                    />
                    <div class="grid grid-cols-4 gap-2">
                      {#each [0, 500, 1000, 2000] as amount}
                        <button
                          class="touch-button rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.09]"
                          on:click={() => applyQuickDiscount(amount)}
                        >
                          {amount === 0 ? 'Reset' : amount}
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>

                <div class="panel-muted p-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Numpad</p>
                      <p class="mt-2 text-sm text-slate-300">
                        {paymentOpen && paymentMethod === 'CASH'
                          ? 'Editing cash received'
                          : selectedCartItem
                            ? `Editing ${selectedCartItem.name}`
                            : 'Select a cart row'}
                      </p>
                    </div>
                    <div class="rounded-2xl bg-slate-950/70 px-4 py-3 text-right">
                      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Input</p>
                      <p class="mt-1 text-2xl font-bold text-white">
                        {paymentOpen && paymentMethod === 'CASH'
                          ? cashReceived || '0'
                          : keypadBuffer || '0'}
                      </p>
                    </div>
                  </div>

                  <div class="mt-4 grid grid-cols-3 gap-2">
                    {#each keypadRows as row}
                      {#each row as value}
                        <button
                          class="touch-button rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-slate-100 hover:bg-white/[0.1]"
                          on:click={() => handleKeypadPress(value)}
                        >
                          {value}
                        </button>
                      {/each}
                    {/each}
                  </div>

                  <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      class="touch-button inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-slate-100 hover:bg-white/[0.1]"
                      on:click={openDeliveryModal}
                    >
                      Delivery
                    </button>
                    <button
                      class="touch-button inline-flex w-full items-center justify-center rounded-2xl bg-orange-400 px-5 text-slate-950 shadow-[0_24px_50px_-24px_rgba(251,146,60,0.95)] hover:bg-orange-300"
                      on:click={openPaymentModal}
                    >
                      Checkout
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {#if copiedReceipt}
              <div class="panel-muted max-h-56 overflow-auto p-4">
                <div class="flex items-center justify-between">
                  <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Print Simulation</p>
                  <button
                    class="touch-button rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.1]"
                    on:click={() => void copyText(copiedReceipt)}
                  >
                    Copy Again
                  </button>
                </div>
                <pre class="mt-4 whitespace-pre-wrap text-xs leading-6 text-slate-300">{copiedReceipt}</pre>
              </div>
            {/if}
          </div>
        </section>
      </div>
    </main>
  </div>

  {#if activeConflict}
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/72 p-4 backdrop-blur-sm sm:items-center">
      <div class="panel-surface max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-rose-200/80">Manager Review</p>
            <h3 class="mt-2 text-2xl font-bold text-white">{activeConflict.saleNumber}</h3>
            <p class="mt-2 text-sm text-slate-300">
              {activeConflict.lastError ?? 'Sync conflict detected.'}
            </p>
          </div>
          <button
            class="touch-button rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.1]"
            on:click={closeConflictDetails}
          >
            Close
          </button>
        </div>

        <div class="mt-6 grid gap-4 lg:grid-cols-[0.92fr,1.08fr]">
          <div class="panel-muted p-4">
            <p class="text-xs uppercase tracking-[0.22em] text-slate-400">Sale Snapshot</p>
            <div class="mt-4 grid gap-3 text-sm text-slate-300">
              <div class="flex items-center justify-between gap-3">
                <span>Customer</span>
                <strong class="text-right text-white">
                  {activeConflict.payload.sale.customer_name || 'Walk-in Customer'}
                </strong>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span>Payment</span>
                <strong class="text-white">{activeConflict.payload.sale.payment_method}</strong>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span>Net Amount</span>
                <strong class="text-white">{formatMMK(activeConflict.payload.sale.net_amount)} MMK</strong>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span>Detected</span>
                <strong class="text-right text-white">
                  {formatConflictTimestamp(activeConflict.conflictDetails?.detectedAt)}
                </strong>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span>Queued At</span>
                <strong class="text-right text-white">
                  {formatConflictTimestamp(activeConflict.queuedAt)}
                </strong>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span>Retries</span>
                <strong class="text-white">{activeConflict.retryCount}</strong>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span>HTTP Status</span>
                <strong class="text-white">
                  {activeConflict.lastHttpStatus ? `HTTP ${activeConflict.lastHttpStatus}` : 'Not returned'}
                </strong>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span>Review Type</span>
                <strong class="text-white">
                  {activeConflict.errorKind ?? activeConflict.conflictDetails?.kind ?? 'UNKNOWN'}
                </strong>
              </div>
              {#if activeConflict.payload.sale.delivery_provider || activeConflict.payload.sale.delivery_fee}
                <div class="flex items-center justify-between gap-3">
                  <span>Delivery</span>
                  <strong class="text-right text-white">
                    {activeConflict.payload.sale.delivery_provider ?? 'MANUAL'}
                    {#if activeConflict.payload.sale.delivery_fee}
                      - {formatMMK(activeConflict.payload.sale.delivery_fee)} MMK
                    {/if}
                  </strong>
                </div>
              {/if}
            </div>
          </div>

          <div class="panel-muted p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs uppercase tracking-[0.22em] text-slate-400">Line Items</p>
              <span class="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                {activeConflict.payload.details.length} rows
              </span>
            </div>

            <div class="mt-4 space-y-3">
              {#each activeConflict.payload.details as detail}
                <article class="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-semibold text-white">{detail.item_name}</p>
                      <p class="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {detail.item_code}
                      </p>
                    </div>
                    <strong class="text-white">{formatMMK(detail.line_total)} MMK</strong>
                  </div>
                  <div class="mt-3 flex items-center justify-between text-sm text-slate-300">
                    <span>{detail.quantity} x {formatMMK(detail.unit_price)} MMK</span>
                    <span>Discount {formatMMK(detail.discount ?? 0)} MMK</span>
                  </div>
                </article>
              {/each}
            </div>
          </div>
        </div>

        {#if activeConflict.conflictDetails?.responseBody}
          <div class="panel-muted mt-4 p-4">
            <p class="text-xs uppercase tracking-[0.22em] text-slate-400">Server Response</p>
            <pre class="mt-4 overflow-x-auto whitespace-pre-wrap rounded-[1.2rem] bg-slate-950/70 p-4 text-xs leading-6 text-slate-300">{JSON.stringify(activeConflict.conflictDetails.responseBody, null, 2)}</pre>
          </div>
        {/if}

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            class="touch-button rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.1]"
            on:click={closeConflictDetails}
          >
            Close
          </button>
          <button
            class="touch-button rounded-2xl border border-teal-300/20 bg-teal-400/10 px-5 text-teal-100 hover:bg-teal-400/18"
            on:click={() => {
              if (activeConflict) {
                requestConflictAction('edit', activeConflict);
              }
            }}
          >
            Edit In Cart
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if pendingReviewAction}
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/72 p-4 backdrop-blur-sm sm:items-center">
      <div class="panel-surface w-full max-w-lg p-6">
        <p class="text-xs uppercase tracking-[0.35em] text-rose-200/80">Confirm Action</p>
        <h3 class="mt-2 text-2xl font-bold text-white">
          {reviewActionTitle(pendingReviewAction.type)}
        </h3>
        <p class="mt-3 text-sm text-slate-300">
          {reviewActionDescription(pendingReviewAction)}
        </p>

        <div class="panel-muted mt-5 p-4 text-sm text-slate-300">
          <div class="flex items-center justify-between gap-3">
            <span>Sale Number</span>
            <strong class="text-white">{pendingReviewAction.conflict.saleNumber}</strong>
          </div>
          <div class="mt-3 flex items-center justify-between gap-3">
            <span>Customer</span>
            <strong class="text-right text-white">
              {pendingReviewAction.conflict.payload.sale.customer_name || 'Walk-in Customer'}
            </strong>
          </div>
          <div class="mt-3 flex items-center justify-between gap-3">
            <span>Amount</span>
            <strong class="text-white">
              {formatMMK(pendingReviewAction.conflict.payload.sale.net_amount)} MMK
            </strong>
          </div>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            class="touch-button rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.1]"
            on:click={closeConflictAction}
          >
            Cancel
          </button>
          <button
            class="touch-button rounded-2xl bg-rose-400 px-5 text-slate-950 shadow-[0_24px_50px_-24px_rgba(251,113,133,0.95)] hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={reviewBusyId === pendingReviewAction.conflict.id}
            on:click={() => void confirmConflictAction()}
          >
            {reviewBusyId === pendingReviewAction.conflict.id
              ? 'Working...'
              : reviewActionConfirmLabel(pendingReviewAction.type)}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if paymentOpen}
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center">
      <div class="panel-surface w-full max-w-xl p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-teal-300/80">Checkout Flow</p>
            <h3 class="mt-2 text-2xl font-bold text-white">Finalize payment</h3>
            <p class="mt-2 text-sm text-slate-400">Choose payment mode, then copy a plain-text invoice for print simulation.</p>
          </div>
          <button
            class="touch-button rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.1]"
            on:click={closePaymentModal}
          >
            Close
          </button>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          {#each ['CASH', 'CREDIT'] as option}
            <button
              class={`touch-button rounded-[1.4rem] border px-5 py-4 text-left ${
                paymentMethod === option
                  ? 'border-teal-400/35 bg-teal-400/12 text-white'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
              }`}
              on:click={() => setPaymentOption(option === 'CASH' ? 'CASH' : 'CREDIT')}
            >
              <span class="block text-base font-semibold">{option}</span>
              <span class="mt-1 block text-sm text-slate-400">
                {option === 'CASH' ? 'Collect now and calculate change' : 'Store as customer receivable'}
              </span>
            </button>
          {/each}
        </div>

        <div class="mt-6 grid gap-4 sm:grid-cols-2">
          <div class="panel-muted p-4">
            <p class="text-xs uppercase tracking-[0.22em] text-slate-400">Grand Total</p>
            <p class="mt-2 text-3xl font-bold text-white">{formatMMK(grandTotal)} MMK</p>
            {#if deliverySelection}
              <p class="mt-3 text-sm text-slate-300">
                Includes {deliverySelection.provider} delivery fee of
                <strong class="text-white">{formatMMK(deliverySelection.fee)} MMK</strong>
              </p>
            {/if}
          </div>

          {#if paymentMethod === 'CASH'}
            <div class="panel-muted p-4">
              <label class="text-xs uppercase tracking-[0.22em] text-slate-400" for="cash-received">Cash Received</label>
              <input
                id="cash-received"
                bind:value={cashReceived}
                class="touch-button mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/60 text-2xl text-slate-100"
                inputmode="numeric"
                placeholder="0"
              />
              <p class="mt-3 text-sm text-slate-300">Change: <strong class="text-white">{formatMMK(projectedChange)} MMK</strong></p>
            </div>
          {:else}
            <div class="panel-muted p-4">
              <label class="text-xs uppercase tracking-[0.22em] text-slate-400" for="credit-customer">Customer Name</label>
              <input
                id="credit-customer"
                bind:value={creditCustomer}
                class="touch-button mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
                placeholder="Enter customer name"
              />
              <p class="mt-3 text-sm text-slate-300">Balance will be tracked as receivable.</p>
            </div>
          {/if}
        </div>

        {#if checkoutError}
          <div class="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {checkoutError}
          </div>
        {/if}

        <div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input 
              type="checkbox" 
              bind:checked={printReceiptToggle}
              class="h-5 w-5 rounded border-white/10 bg-slate-950/60 text-teal-400 focus:ring-teal-400 focus:ring-offset-slate-950/70"
            />
            Print Receipt
          </label>
          <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              class="touch-button rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.1]"
              on:click={closePaymentModal}
            >
              Cancel
            </button>
            <button
              class="touch-button rounded-2xl bg-teal-400 px-5 text-slate-950 shadow-[0_24px_50px_-24px_rgba(45,212,191,0.95)] hover:bg-teal-300"
              on:click={() => void confirmCheckout()}
            >
              {printReceiptToggle ? 'Confirm & Print' : 'Confirm & Copy Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <DeliveryModal
    open={deliveryOpen}
    cartItems={cartItems}
    tenantId={resolveTenantId(auth.activation.tenantId)}
    companyName={auth.companyName}
    on:apply={handleDeliveryApplied}
    on:clear={clearDeliverySelection}
    on:close={closeDeliveryModal}
  />

  <div class="pointer-events-none fixed bottom-4 right-4 z-40 space-y-3">
    {#each ui.toasts as toast (toast.id)}
      <div class="pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/88 px-4 py-3 text-sm text-slate-100 shadow-2xl backdrop-blur-xl">
        {toast.message}
      </div>
    {/each}
  </div>
</div>
