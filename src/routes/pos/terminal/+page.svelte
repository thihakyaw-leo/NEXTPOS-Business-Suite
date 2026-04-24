<script lang="ts">
  import { tick } from 'svelte';
  import DeliveryModal from '$lib/components/DeliveryModal.svelte';
  import { resolveTenantId } from '$lib/api/tenant';
  import { syncPendingSales } from '$lib/syncManager';
  import { auth } from '$lib/stores/auth.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { sales } from '$lib/stores/sales.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { cartStore } from '$lib/stores/cartStore.js';
  import { counterStore } from '$lib/stores/counterStore.svelte';
  import { formatMMK, type DeliverySelection, type PaymentMethod, type Product, type ProductCategory } from '$lib/types/index';
  import { fade, scale, slide } from 'svelte/transition';

  type TerminalCategory = ProductCategory | 'all';
  type CheckoutMethod = Extract<PaymentMethod, 'CASH' | 'CREDIT'>;

  let showCounterModal = $state(!counterStore.isOpen);
  let counterForm = $state({
    name: 'Counter 01',
    openingBalance: 0,
    note: ''
  });

  let saleInfo = $state({
    customer: 'Walk-In Customer',
    date: new Date().toISOString().slice(0, 10),
    outlet: 'Main Branch',
    invoiceNo: 'SALE-' + Date.now().toString().slice(-6),
    type: 'Regular Sale' as 'Regular Sale' | 'Delivery Sale' | 'Draft Sale'
  });

  let searchQuery = $state('');
  let activeCategory = $state<TerminalCategory>('all');
  let selectedItemCode = $state<string | null>(null);
  let paymentOpen = $state(false);
  let cashReceived = $state('');
  let creditCustomer = $state('');
  let deliveryOpen = $state(false);
  let deliverySelection = $state<DeliverySelection | null>(null);
  let printReceiptToggle = $state(true);

  let filteredProducts = $derived(products.all.filter((p) => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const query = searchQuery.trim().toLowerCase();
    return matchesCategory && (!query || p.name.toLowerCase().includes(query) || p.itemCode.toLowerCase().includes(query));
  }));

  let cart = $derived($cartStore);
  let grandTotal = $derived(cart.grandTotal);

  function handleOpenCounter() {
    counterStore.open(counterForm.name, counterForm.openingBalance, auth.username);
    showCounterModal = false;
    ui.success('Counter session started');
  }

  async function addProduct(product: Product) {
    cartStore.addItem(product);
    ui.success(`Added ${product.name}`);
  }

  async function confirmCheckout() {
    if (!cart.items.length) return;
    sales.addSale({
      id: Date.now(),
      saleNumber: saleInfo.invoiceNo,
      saleDate: new Date().toISOString(),
      customerName: saleInfo.customer,
      totalAmount: cart.subtotal,
      taxAmount: 0,
      discountAmount: cart.discount,
      netAmount: cart.grandTotal,
      paymentMethod: 'CASH',
      status: 'COMPLETED'
    });
    cartStore.clear();
    paymentOpen = false;
    ui.success('Sale completed successfully');
  }
</script>

<svelte:head>
  <title>Transaction Console | KT POS</title>
</svelte:head>

<main class="flex h-screen w-screen overflow-hidden bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
  <!-- Immersive Terminal Primary Area -->
  <section class="flex-1 flex flex-col min-w-0 bg-zinc-900/40 relative">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.03),transparent_40%)] pointer-events-none"></div>

    <!-- Active Session Telemetry -->
     <header class="p-6 bg-white/[0.02] border-b border-white/5 grid grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
        <div class="space-y-2">
           <label for="customer-input" class="text-[8px] font-black uppercase text-white/20 tracking-[0.3em] italic">Active_Customer</label>
           <div class="flex gap-2">
              <input id="customer-input" type="text" bind:value={saleInfo.customer} class="flex-1 bg-zinc-800 border border-white/5 p-3 text-[10px] font-black text-white outline-none focus:border-emerald-500/50 italic tracking-widest uppercase transition-all" />
              <button class="bg-emerald-500 text-white px-3 text-sm font-black hover:bg-emerald-400 transition-colors">+</button>
           </div>
        </div>
        <div class="space-y-2">
           <label for="date-input" class="text-[8px] font-black uppercase text-white/20 tracking-[0.3em] italic">Chronos_Signature</label>
           <input id="date-input" type="date" bind:value={saleInfo.date} class="w-full bg-zinc-800 border border-white/5 p-3 text-[10px] font-black text-white outline-none focus:border-emerald-500/50 uppercase transition-all" />
        </div>
        <div class="space-y-2">
           <label for="node-selector" class="text-[8px] font-black uppercase text-white/20 tracking-[0.3em] italic">Distribution_Node</label>
           <select id="node-selector" bind:value={saleInfo.outlet} class="w-full bg-zinc-800 border border-white/5 p-3 text-[10px] font-black text-white outline-none focus:border-emerald-500/50 uppercase italic tracking-widest transition-all">
              <option>Main Branch</option>
              <option>South Dagon</option>
           </select>
        </div>
        <div class="space-y-2">
           <span class="text-[8px] font-black uppercase text-white/20 tracking-[0.3em] italic block">Transaction_ID</span>
           <div class="bg-zinc-800 border border-white/5 p-3 text-[10px] font-black text-white/40 tracking-widest uppercase italic">
             {saleInfo.invoiceNo}
           </div>
        </div>
     </header>

    <!-- Command / Search Matrix -->
    <div class="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between gap-6 bg-white/[0.01] relative z-10">
       <div class="flex-1 relative group">
          <div class="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-500 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="SCAN_BARCODE_OR_EXECUTE_SEARCH_QUERY..." 
            class="w-full h-12 bg-zinc-800/50 border border-white/5 pl-12 pr-6 text-[11px] font-black text-white outline-none focus:border-emerald-500/50 tracking-[0.1em] placeholder:text-white/10 uppercase italic transition-all" 
            bind:value={searchQuery} 
          />
       </div>
       <div class="flex gap-4 items-center">
          {#each (['Regular Sale', 'Delivery Sale', 'Draft Sale'] as const) as type}
             <button 
                class="px-6 py-3 glass-panel border-none text-[9px] font-black uppercase tracking-widest italic transition-all {saleInfo.type === type ? 'bg-emerald-500 text-white shadow-[0_0_20px_#22c55e44]' : 'bg-white/5 text-white/30 hover:bg-white/10 opacity-60 hover:opacity-100'}"
                onclick={() => saleInfo.type = type}
             >
                {type.replace(' ', '_')}
             </button>
          {/each}
       </div>
    </div>

    <!-- Product Matrix Console -->
    <div class="flex-1 overflow-y-auto p-8 relative z-10 thin-scrollbar">
       <div class="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          {#each filteredProducts as p (p.id)}
             <button 
                onclick={() => addProduct(p)} 
                class="glass-panel p-5 text-left group hover:border-emerald-500/40 transition-all duration-300 relative overflow-hidden"
                in:scale={{ duration: 300, delay: 50 }}
             >
                <div class="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
                <div class="flex justify-between items-start mb-4">
                    <span class="text-[8px] font-black text-white/20 tracking-widest uppercase italic">{p.itemCode}</span>
                    {#if p.stock <= 5}
                        <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]"></span>
                    {/if}
                </div>
                <p class="text-[11px] font-black uppercase text-white italic line-clamp-1 leading-tight group-hover:text-emerald-400 transition-colors">{p.name}</p>
                <div class="mt-4 flex flex-col gap-1">
                    <p class="text-lg font-black text-white italic tabular-nums leading-none tracking-tighter">{formatMMK(p.sellingPrice)}</p>
                    <p class="text-[8px] font-black text-white/20 uppercase italic mt-1">Stock: <span class={p.stock <= 5 ? 'text-rose-500' : 'text-emerald-500'}>{p.stock}</span></p>
                </div>
             </button>
          {/each}
       </div>
    </div>
  </section>

  <!-- Interactive Cart / Sidebar -->
  <aside class="w-[420px] shrink-0 flex flex-col bg-zinc-950 border-l border-white/5 relative shadow-[-50px_0_100px_-20px_rgba(0,0,0,0.5)]">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.05),transparent_60%)] pointer-events-none"></div>

    <div class="h-20 flex items-center justify-between px-8 border-b border-white/5 bg-white/[0.01]">
       <div>
         <h2 class="text-[11px] font-black uppercase tracking-[0.4em] text-white italic">Transaction_Buffer</h2>
         <p class="text-[8px] text-white/20 font-black uppercase italic tracking-widest mt-1">Processing queue active</p>
       </div>
       <button class="glass-button secondary px-4 py-2 text-[8px] font-black uppercase tracking-widest transition-all italic underline decoration-rose-500/30" onclick={() => cartStore.clear()}>CLEAR_BUFFER</button>
    </div>

    <!-- Active Item Stream -->
    <div class="flex-1 overflow-y-auto p-6 space-y-4 thin-scrollbar">
       {#each cart.items as item (item.itemCode)}
          <div class="p-5 glass-panel border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all group relative overflow-hidden" in:slide={{ duration: 300 }}>
             <div class="absolute -left-1 top-4 bottom-4 w-1 bg-emerald-500/20 group-hover:bg-emerald-500 transition-colors"></div>
             <div class="flex justify-between items-start">
                <div class="flex-1 min-w-0 pr-4">
                   <p class="text-[10px] font-black uppercase text-white italic tracking-wider line-clamp-1 group-hover:text-emerald-400 transition-colors">{item.name}</p>
                   <div class="flex items-center gap-3 mt-2">
                       <span class="text-[9px] font-black text-white/20 italic tabular-nums tracking-widest">{item.quantity} UNIT(S) @ {formatMMK(item.price)}</span>
                   </div>
                </div>
                <div class="text-right">
                    <p class="text-xs font-black text-white italic tabular-nums tracking-tighter">{formatMMK((item.price * item.quantity) - item.discount)}</p>
                    <button class="text-[8px] font-black text-rose-500/40 hover:text-rose-500 mt-2 transition-colors uppercase italic" onclick={() => cartStore.removeItem(item.itemCode)}>REMOVE_ITEM</button>
                </div>
             </div>
          </div>
       {/each}

       {#if cart.items.length === 0}
          <div class="h-full flex flex-col items-center justify-center opacity-10 space-y-4 py-40">
             <div class="w-16 h-16 border-2 border-white/10 rounded-full flex items-center justify-center text-2xl">⚡</div>
             <p class="text-[10px] font-black uppercase tracking-[0.5em] italic">Ready for ingestion</p>
          </div>
       {/if}
    </div>

    <!-- Settlement Console -->
    <div class="p-8 border-t border-white/5 bg-white/[0.02] space-y-6 relative overflow-hidden">
       <div class="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none"></div>

       <div class="space-y-3">
           <div class="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] italic">
              <span class="text-white/30">Aggregate_Volume</span>
              <span class="text-white tabular-nums">{formatMMK(cart.subtotal)}</span>
           </div>
           <div class="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] italic">
              <span class="text-rose-500/60">Discretionary_Reduction</span>
              <span class="text-rose-500 tabular-nums">-{formatMMK(cart.discount)}</span>
           </div>
       </div>

       <div class="pt-6 border-t border-white/5 flex justify-between items-end">
          <div class="space-y-1">
            <span class="text-[9px] font-black uppercase text-white/20 tracking-[0.3em] italic leading-none">Net_Authorization_Target</span>
            <div class="flex items-center gap-3">
               <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
               <span class="text-4xl font-black text-white leading-none tracking-tighter tabular-nums italic decoration-emerald-500 decoration-4 underline underline-offset-8 decoration-solid">{formatMMK(grandTotal)}</span>
            </div>
          </div>
       </div>

       <button 
         onclick={() => paymentOpen = true}
         disabled={cart.items.length === 0}
         class="w-full glass-button primary py-5 text-[11px] font-black uppercase tracking-[0.5em] italic shadow-[0_20px_50px_-10px_rgba(34,197,94,0.3)] group mt-4 relative overflow-hidden"
       >
         <div class="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-[-20deg]"></div>
         AUTHORIZE_SETTLEMENT
       </button>
    </div>
  </aside>
</main>

<!-- Executive Registry Modal -->
{#if showCounterModal}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl animate-in fade-in duration-500">
    <div class="glass-panel w-full max-w-lg border-t-4 border-emerald-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] overflow-hidden" in:scale={{ duration: 400 }}>
       <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h2 class="text-xl font-black uppercase italic tracking-tighter text-white">Counter_Register_Initialization</h2>
            <p class="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mt-1">Personnel access protocol active</p>
          </div>
          <button class="h-10 w-10 glass-panel flex items-center justify-center text-white/20 hover:text-white transition-all font-black text-lg" onclick={() => window.location.href = '/pos/dashboard'}>✕</button>
       </div>
       <div class="p-10 space-y-8">
          <div class="space-y-3">
             <label for="terminal-selector" class="block text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Assigned_Terminal</label>
             <select id="terminal-selector" bind:value={counterForm.name} class="w-full bg-zinc-800 border border-white/5 p-4 text-xs font-black text-white outline-none focus:border-emerald-500/50 uppercase italic tracking-widest transition-all">
                <option>Counter 01</option>
                <option>Counter 02</option>
             </select>
          </div>
          <div class="space-y-3">
             <label for="balance-input" class="block text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Initial_Reserve_Balance (Ks)</label>
             <input id="balance-input" type="number" bind:value={counterForm.openingBalance} class="w-full bg-zinc-800 border border-white/5 p-4 text-2xl font-black text-emerald-500 outline-none focus:border-emerald-500/50 tabular-nums italic" />
          </div>
          <div class="space-y-3">
             <label for="note-input" class="block text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Session_Audit_Note</label>
             <textarea id="note-input" bind:value={counterForm.note} placeholder="ENTER_SESSION_PARAMETERS..." class="w-full bg-zinc-800 border border-white/5 p-4 text-[11px] font-black text-white h-24 outline-none focus:border-emerald-500/50 uppercase italic tracking-wider transition-all"></textarea>
          </div>
       </div>
       <div class="p-8 bg-white/5 border-t border-white/5 flex justify-end gap-6">
          <button class="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-colors italic" onclick={() => window.location.href = '/pos/dashboard'}>ABORT_SESSION</button>
          <button class="glass-button primary px-12 py-4 text-[10px] font-black italic shadow-2xl shadow-emerald-500/20" onclick={handleOpenCounter}>ACTIVATE_TRANS_CONSOLE</button>
       </div>
    </div>
  </div>
{/if}

<!-- Biometric-style Settlement Portal -->
{#if paymentOpen}
  <div class="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl" in:fade>
     <div class="glass-panel w-full max-w-md p-10 border-t-4 border-emerald-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] relative overflow-hidden" in:scale>
        <div class="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/5 blur-[100px] rounded-full"></div>
        
        <div class="text-center space-y-2 mb-10">
            <h3 class="text-2xl font-black uppercase italic tracking-tighter text-white">Settlement_Authorization</h3>
            <p class="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Awaiting final transaction lock</p>
        </div>

        <div class="p-6 glass-panel border-white/5 bg-white/[0.02] mb-10 text-center">
            <p class="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 italic">Total_Fiscal_Obligation</p>
            <p class="text-4xl font-black text-white italic tabular-nums tracking-tighter">{formatMMK(grandTotal)}</p>
        </div>

        <div class="space-y-4">
            <button onclick={confirmCheckout} class="w-full glass-button primary py-5 font-black uppercase text-[11px] tracking-[0.4em] italic shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-4">
               <span class="h-2 w-2 rounded-full bg-white animate-pulse"></span> LOCK_TRANS_AND_PRINT
            </button>
            <button onclick={() => paymentOpen = false} class="w-full text-white/20 hover:text-rose-500 py-2 text-[10px] font-black uppercase tracking-[0.5em] italic transition-colors">ABORT_SETTLEMENT</button>
        </div>
     </div>
  </div>
{/if}

<!-- Telemetry Toasts -->
<div class="pointer-events-none fixed bottom-8 right-8 z-[300] space-y-4">
  {#each ui.toasts as toast (toast.id)}
    <div class="pointer-events-auto glass-panel px-6 py-4 text-[10px] font-black uppercase border-l-4 border-emerald-500 text-white italic tracking-widest shadow-2xl animate-in slide-in-from-right duration-500" out:fade={{ duration: 200 }}>
       <div class="flex items-center gap-3">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {toast.message.replace(' ', '_')}
       </div>
    </div>
  {/each}
</div>

<style lang="postcss">
    @reference "tailwindcss";
  :global(body) { 
    @apply bg-zinc-950 p-0; 
  }

  .thin-scrollbar::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  .thin-scrollbar::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .thin-scrollbar::-webkit-scrollbar-thumb {
    @apply bg-white/5 rounded-full hover:bg-emerald-500/20 transition-all;
  }

  .glass-panel {
    @apply bg-[#111111]/80 backdrop-blur-xl border border-white/5 shadow-2xl;
  }

  .glass-button {
    @apply border rounded-sm uppercase tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed;
  }

  .glass-button.primary {
    @apply bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-400;
  }

  .glass-button.secondary {
    @apply bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20;
  }
</style>
