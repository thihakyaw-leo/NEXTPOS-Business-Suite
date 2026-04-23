<svelte:options runes={false} />

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { buildTenantHeaders } from '$lib/api/tenant';
  import { formatMMK, type CartItem, type DeliveryQuote, type DeliverySelection } from '$lib/types/index';

  type ApiQuote = {
    provider: DeliveryQuote['provider'];
    service_type: string;
    fee: number;
    currency: string;
    estimated_pickup_at?: string | null;
    estimated_dropoff_at?: string | null;
    distance_m?: number | null;
    quote_id?: string | null;
    message?: string | null;
  };

  export let open = false;
  export let cartItems: CartItem[] = [];
  export let tenantId = '';
  export let companyName = 'NextPOS';

  const dispatch = createEventDispatcher();

  let pickupAddress = '';
  let storePhone = '';
  let recipientName = '';
  let recipientPhone = '';
  let dropoffAddress = '';
  let dropoffNote = '';
  let distanceKm = '5';
  let quotes: DeliveryQuote[] = [];
  let selectedProvider: DeliveryQuote['provider'] | null = null;
  let isLoading = false;
  let errorMessage = '';
  let openedOnce = false;

  $: saleableItems = cartItems.filter((item) => item.kind !== 'service_charge');
  $: packageCount = saleableItems.reduce((sum, item) => sum + item.quantity, 0);
  $: orderSubtotal = roundCurrency(
    saleableItems.reduce((sum, item) => sum + ((item.price * item.quantity) - item.discount), 0),
  );
  $: if (open && !openedOnce) {
    pickupAddress = pickupAddress || `${companyName}, Yangon`;
    recipientName = recipientName || 'Walk-in Customer';
    openedOnce = true;
  }
  $: if (!open) {
    openedOnce = false;
  }

  async function estimateDelivery() {
    errorMessage = '';

    if (!saleableItems.length) {
      errorMessage = 'Add at least one product before requesting delivery.';
      return;
    }

    if (!pickupAddress.trim() || !dropoffAddress.trim() || !recipientName.trim() || !recipientPhone.trim()) {
      errorMessage = 'Pickup address, recipient name, recipient phone, and dropoff address are required.';
      return;
    }

    isLoading = true;

    try {
      const payload = buildEstimatePayload();
      const response = await fetch('/api/delivery/estimate', {
        method: 'POST',
        headers: buildRequestHeaders(),
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            data?: ApiQuote[];
          }
        | null;

      if (!response.ok || !result?.data?.length) {
        quotes = buildFallbackQuotes();
        selectedProvider = quotes[0]?.provider ?? null;
        errorMessage = result?.error
          ? `${result.error} Showing local estimates instead.`
          : 'Delivery API unavailable. Showing local estimates instead.';
        return;
      }

      quotes = result.data
        .map((quote) => ({
          provider: quote.provider,
          serviceType: quote.service_type,
          fee: quote.fee,
          currency: quote.currency,
          estimatedPickupAt: quote.estimated_pickup_at ?? null,
          estimatedDropoffAt: quote.estimated_dropoff_at ?? null,
          distanceM: quote.distance_m ?? null,
          quoteId: quote.quote_id ?? null,
          message: quote.message ?? null,
        }))
        .sort((left, right) => left.fee - right.fee);
      selectedProvider = quotes[0]?.provider ?? null;
    } catch (error) {
      quotes = buildFallbackQuotes();
      selectedProvider = quotes[0]?.provider ?? null;
      errorMessage =
        error instanceof Error
          ? `${error.message} Showing local estimates instead.`
          : 'Delivery API unavailable. Showing local estimates instead.';
    } finally {
      isLoading = false;
    }
  }

  function applySelection(quote: DeliveryQuote) {
    const selection: DeliverySelection = {
      provider: quote.provider,
      fee: quote.fee,
      currency: quote.currency,
      serviceType: quote.serviceType,
      quoteId: quote.quoteId ?? null,
      pickupAddress: pickupAddress.trim(),
      dropoffAddress: dropoffAddress.trim(),
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      note: dropoffNote.trim(),
    };

    dispatch('apply', { selection });
  }

  function closeModal() {
    dispatch('close');
  }

  function clearSelection() {
    quotes = [];
    selectedProvider = null;
    errorMessage = '';
    dispatch('clear');
  }

  function buildEstimatePayload() {
    return {
      tenant_id: tenantId,
      provider_codes: ['MOCK', 'GRAB', 'MANUAL'],
      pickup: {
        name: companyName,
        phone: sanitizePhone(storePhone),
        address: pickupAddress.trim(),
      },
      dropoff: {
        name: recipientName.trim(),
        phone: sanitizePhone(recipientPhone),
        address: dropoffAddress.trim(),
        notes: dropoffNote.trim() || undefined,
      },
      packages: saleableItems.map((item) => ({
        name: item.name,
        description: `${item.quantity} x ${item.name}`,
        quantity: item.quantity,
        price: item.price,
        dimensions: {
          height: 10,
          width: 10,
          depth: 10,
          weight: 400,
        },
      })),
      order_total: orderSubtotal,
      distance_km: Math.max(1, Number(distanceKm || 0) || 1),
      currency: 'MMK',
    };
  }

  function buildFallbackQuotes(): DeliveryQuote[] {
    const distance = Math.max(1, Number(distanceKm || 0) || 1);
    const itemWeight = packageCount * 100;

    const fallbackQuotes: DeliveryQuote[] = [
      {
        provider: 'MANUAL',
        serviceType: 'MANUAL_DISPATCH',
        fee: roundCurrency(1000 + distance * 180 + itemWeight * 0.2),
        currency: 'MMK',
        estimatedPickupAt: null,
        estimatedDropoffAt: null,
        distanceM: Math.round(distance * 1000),
        message: 'Store-managed dispatch estimate',
      },
      {
        provider: 'MOCK',
        serviceType: 'DEV_SAME_DAY',
        fee: roundCurrency(1500 + distance * 450 + packageCount * 120),
        currency: 'MMK',
        estimatedPickupAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        estimatedDropoffAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        distanceM: Math.round(distance * 1000),
        message: 'Development estimate',
      },
      {
        provider: 'GRAB',
        serviceType: 'INSTANT',
        fee: roundCurrency(2200 + distance * 550 + orderSubtotal * 0.0125),
        currency: 'MMK',
        estimatedPickupAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        estimatedDropoffAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        distanceM: Math.round(distance * 1000),
        message: 'Fallback estimate while live provider access is unavailable',
      },
    ];

    return fallbackQuotes.sort((left, right) => left.fee - right.fee);
  }

  function buildRequestHeaders(): Record<string, string> {
    return buildTenantHeaders(tenantId);
  }

  function sanitizePhone(value: string): string {
    const digits = value.replace(/[^\d]/g, '');
    return digits || '959000000000';
  }

  function roundCurrency(value: number): number {
    return Number(value.toFixed(2));
  }

  function formatEta(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleTimeString('en-MM', { hour: '2-digit', minute: '2-digit' }) : 'Flexible';
  }
</script>

{#if open}
  <div class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/75 p-4 backdrop-blur-sm sm:items-center">
    <div class="panel-surface w-full max-w-4xl p-6">
      <div class="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.35em] text-orange-200/80">Delivery Service</p>
          <h3 class="mt-2 text-2xl font-bold text-white">Estimate courier fee</h3>
          <p class="mt-2 max-w-2xl text-sm text-slate-400">
            Compare providers, then append the selected delivery fee to the cart as a service charge.
          </p>
        </div>
        <div class="flex gap-3">
          <button
            class="touch-button rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.1]"
            on:click={clearSelection}
            type="button"
          >
            Clear Delivery
          </button>
          <button
            class="touch-button rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.1]"
            on:click={closeModal}
            type="button"
          >
            Close
          </button>
        </div>
      </div>

      <div class="mt-6 grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
        <section class="panel-muted p-4">
          <div class="grid gap-4">
            <label class="grid gap-2">
              <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Pickup Address</span>
              <textarea
                bind:value={pickupAddress}
                class="touch-button min-h-24 rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
                placeholder="Store or warehouse pickup address"
              ></textarea>
            </label>

            <label class="grid gap-2">
              <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Store Phone</span>
              <input
                bind:value={storePhone}
                class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
                placeholder="09..."
              />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Recipient Name</span>
                <input
                  bind:value={recipientName}
                  class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
                  placeholder="Customer name"
                />
              </label>

              <label class="grid gap-2">
                <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Recipient Phone</span>
                <input
                  bind:value={recipientPhone}
                  class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
                  placeholder="09..."
                />
              </label>
            </div>

            <label class="grid gap-2">
              <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Dropoff Address</span>
              <textarea
                bind:value={dropoffAddress}
                class="touch-button min-h-24 rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
                placeholder="Customer delivery address"
              ></textarea>
            </label>

            <div class="grid gap-4 sm:grid-cols-[1fr,9rem]">
              <label class="grid gap-2">
                <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Driver Note</span>
                <input
                  bind:value={dropoffNote}
                  class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
                  placeholder="Gate code, unit, landmarks"
                />
              </label>

              <label class="grid gap-2">
                <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Distance KM</span>
                <input
                  bind:value={distanceKm}
                  class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
                  min="1"
                  step="0.5"
                  type="number"
                />
              </label>
            </div>
          </div>

          <div class="mt-5 rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
            <div class="flex items-end justify-between">
              <div>
                <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Shipment Summary</p>
                <p class="mt-2 text-2xl font-bold text-white">{formatMMK(orderSubtotal)} MMK</p>
              </div>
              <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                {packageCount} pcs
              </span>
            </div>

            <div class="mt-4 space-y-2 text-sm text-slate-300">
              {#each saleableItems as item}
                <div class="flex items-center justify-between gap-3">
                  <span class="truncate">{item.name}</span>
                  <span>{item.quantity} x {formatMMK(item.price)}</span>
                </div>
              {/each}
            </div>
          </div>

          {#if errorMessage}
            <div class="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {errorMessage}
            </div>
          {/if}

          <button
            class="touch-button mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-orange-400 px-5 text-slate-950 shadow-[0_24px_50px_-24px_rgba(251,146,60,0.95)] hover:bg-orange-300"
            disabled={isLoading}
            on:click={() => void estimateDelivery()}
            type="button"
          >
            {isLoading ? 'Estimating...' : 'Estimate Delivery'}
          </button>
        </section>

        <section class="panel-muted p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Provider Quotes</p>
              <p class="mt-2 text-sm text-slate-300">Lowest fee is preselected. Choose one to attach it to the cart.</p>
            </div>
            {#if quotes.length}
              <span class="rounded-full bg-teal-400/15 px-3 py-1 text-xs font-semibold text-teal-200">
                {quotes.length} options
              </span>
            {/if}
          </div>

          <div class="mt-4 space-y-3">
            {#if quotes.length}
              {#each quotes as quote}
                <article
                  class={`rounded-[1.3rem] border px-4 py-4 transition ${
                    selectedProvider === quote.provider
                      ? 'border-teal-400/35 bg-teal-400/12'
                      : 'border-white/8 bg-white/[0.03]'
                  }`}
                >
                  <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-lg font-semibold text-white">{quote.provider}</p>
                        <span class="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                          {quote.serviceType}
                        </span>
                      </div>
                      <p class="mt-2 text-sm text-slate-400">
                        Pickup {formatEta(quote.estimatedPickupAt)} • Dropoff {formatEta(quote.estimatedDropoffAt)}
                      </p>
                      {#if quote.message}
                        <p class="mt-2 text-xs text-slate-500">{quote.message}</p>
                      {/if}
                    </div>

                    <div class="flex flex-col gap-3 text-right">
                      <p class="text-2xl font-bold text-white">{formatMMK(quote.fee)} {quote.currency}</p>
                      <div class="flex gap-2 lg:justify-end">
                        <button
                          class="touch-button rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.1]"
                          on:click={() => (selectedProvider = quote.provider)}
                          type="button"
                        >
                          Select
                        </button>
                        <button
                          class="touch-button rounded-2xl bg-teal-400 px-4 text-slate-950 hover:bg-teal-300"
                          on:click={() => applySelection(quote)}
                          type="button"
                        >
                          Apply Fee
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              {/each}
            {:else}
              <div class="flex min-h-72 items-center justify-center rounded-[1.3rem] border border-dashed border-white/12 text-center text-sm text-slate-500">
                Run an estimate to compare available providers.
              </div>
            {/if}
          </div>
        </section>
      </div>
    </div>
  </div>
{/if}
