<script lang="ts">
  import { purchaseStore, type PurchaseInvoice } from '$lib/stores/purchaseStore.svelte';
  import { formatMMK } from '$lib/types/index';
  import { ui } from '$lib/stores/ui.svelte';
  import { fade, slide, scale } from 'svelte/transition';

  let showModal = $state(false);
  let formData = $state({
    invoiceNumber: '',
    supplierId: '',
    totalAmount: 0,
    purchaseDate: new Date().toISOString().slice(0, 10),
    status: 'COMPLETED' as PurchaseInvoice['status']
  });

  function handleAdd() {
    if (!formData.invoiceNumber || !formData.supplierId) {
      ui.error('Invoice Number and Supplier are required');
      return;
    }
    const supplier = purchaseStore.allSuppliers.find(s => s.id === formData.supplierId);
    purchaseStore.addInvoice({
      ...formData,
      supplierName: supplier?.name || 'Unknown Supplier',
      purchaseDate: new Date(formData.purchaseDate).toISOString()
    });
    ui.success('Purchase recorded');
    showModal = false;
  }
</script>

<svelte:head>
  <title>Procurement Intelligence | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- Global Telemetry Header -->
  <header class="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>

    <div class="space-y-1 relative max-w-3xl">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">Procurement_Status: OPTIMIZED</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Procurement <span class="text-emerald-500">Intelligence</span>
      </h1>
      <div class="mt-4">
         <p class="text-xs font-black text-white/40 uppercase tracking-widest italic leading-relaxed">
            A smart and organized purchasing process is key to scaling your business. 
            Luckily RetailersPOS delivers you the best POS experience with faster, smarter purchase order handling. 
            It’s time to take charge of your purchasing operations with precision.
         </p>
      </div>
      
      <!-- Rapid Access Nodes -->
      <div class="flex flex-wrap gap-4 mt-6">
         {#each ['Draft Purchase', 'Requisitions', 'Incoming Stock', 'Payment Mgmt'] as node}
            <span class="px-4 py-1.5 glass-panel border-none bg-white/5 text-[8px] font-black uppercase italic tracking-widest text-white/40 group hover:text-emerald-500 transition-colors cursor-default">
               <span class="text-emerald-500 mr-2">/</span> {node}
            </span>
         {/each}
      </div>
    </div>
    
    <div class="flex gap-4 relative">
       <button type="button" class="glass-button secondary px-8 py-4 text-[10px] font-black italic tracking-widest">
         EXPORT_DATASET_RAW
       </button>
       <button type="button" class="glass-button primary px-10 py-4 text-[10px] font-black italic tracking-widest shadow-[0_0_40px_rgba(34,197,94,0.15)] flex items-center gap-3 group active:scale-95" onclick={() => showModal = true}>
         <span class="text-lg group-hover:rotate-180 transition-transform duration-500">+</span> INITIALIZE_NEW_ENTRY
       </button>
    </div>
  </header>

  <!-- Metric Telemetry Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
    <div class="glass-panel p-8 group border-t-2 border-emerald-500/30">
      <div class="flex justify-between items-start mb-6">
        <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic">Aggregate Expenditure</p>
        <div class="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
      </div>
      <div class="flex items-baseline gap-3">
        <p class="text-4xl font-black text-white tracking-tighter italic tabular-nums">{formatMMK(purchaseStore.allInvoices.reduce((s, i) => s + i.totalAmount, 0))}</p>
        <span class="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Growth_β</span>
      </div>
      <div class="mt-8 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div class="h-full bg-emerald-500 shadow-[0_0_15px_#22c55e]" style="width: 82%"></div>
      </div>
    </div>
    
    <div class="glass-panel p-8 group border-t-2 border-amber-500/30">
      <div class="flex justify-between items-start mb-6">
        <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic">Settlement Queue</p>
        <div class="h-2 w-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
      </div>
      <p class="text-4xl font-black text-amber-500 tracking-tighter italic tabular-nums">{purchaseStore.allInvoices.filter(i => i.status === 'PENDING').length} <span class="text-xs text-white/20 not-italic uppercase ml-2 tracking-widest">Invoices_Unpaid</span></p>
      <p class="text-[9px] text-white/20 font-black uppercase mt-8 tracking-widest italic leading-relaxed">Action required for liquidity stability</p>
    </div>

    <div class="glass-panel p-8 group border-t-2 border-zinc-700">
      <div class="flex justify-between items-start mb-6">
        <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic">Vendor Nexus</p>
        <div class="h-2 w-2 rounded-full bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.2)]"></div>
      </div>
      <p class="text-4xl font-black text-white tracking-tighter italic tabular-nums">{purchaseStore.allSuppliers.length} <span class="text-xs text-emerald-500 not-italic uppercase ml-2 tracking-widest">Partners_Active</span></p>
      <p class="text-[9px] text-white/20 font-black uppercase mt-8 tracking-widest italic leading-relaxed">Procurement channel verification : stable</p>
    </div>
  </div>

  <!-- Filtration Intelligence -->
  <div class="glass-panel p-10 relative overflow-hidden">
    <div class="absolute -top-20 -right-20 w-40 h-40 bg-white/5 blur-3xl pointer-events-none"></div>
    
    <div class="flex flex-col lg:flex-row gap-10 items-end">
      <div class="flex-1 w-full">
        <label for="search-input" class="block text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-4 italic">Query Transaction Hub</label>
        <div class="relative group">
          <input 
            id="search-input"
            type="text" 
            placeholder="SCAN_IDENTIFIER_OR_VENDOR_TAG..." 
            class="w-full bg-zinc-900 border border-white/5 px-6 py-4 text-xs font-black text-white placeholder:text-white/5 focus:border-emerald-500/50 outline-none transition-all italic tracking-widest"
          />
          <div class="absolute right-4 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-emerald-500 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      </div>
      
      <div class="flex gap-4">
          <button class="px-8 py-4 glass-panel bg-white/5 text-[10px] font-black text-white/40 italic uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all border border-white/5">
              ALL_DOMAINS
          </button>
          <button class="px-8 py-4 glass-panel bg-white/5 text-[10px] font-black text-white/40 italic uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all border border-white/5">
              SORT_ALPHA_V
          </button>
      </div>
    </div>
  </div>

  <!-- High-Density Transaction Audit -->
  <div class="glass-panel overflow-hidden border-t-2 border-zinc-800">
    <div class="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
      <div>
        <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">Procurement Audit Trail</h3>
        <p class="text-[9px] text-white/20 mt-1 font-black uppercase tracking-widest italic decoration-emerald-500/30 underline">Immutable historical verification registry active</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-4 py-2 glass-panel bg-white/5 text-[10px] font-black text-emerald-500 italic uppercase tracking-widest">
            {purchaseStore.allInvoices.length} LOGS_DETECTED
        </span>
      </div>
    </div>
    
    <div class="overflow-x-auto min-h-[500px] scrollbar-thin">
      <table class="w-full text-left border-separate border-spacing-0">
        <thead>
          <tr class="bg-zinc-900/50 text-white/20 text-[9px] uppercase font-black tracking-[0.25em] italic">
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10 px-10">Identifier</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">Vendor Hub</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10 text-right">Settlement_MMK</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">Timestamp</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">Vector_Status</th>
            <th class="p-6 border-b border-white/5 sticky top-0 bg-zinc-900 z-10 text-right px-10">Interface</th>
          </tr>
        </thead>
        <tbody class="text-xs font-bold text-white/60 divide-y divide-white/5">
          {#each purchaseStore.allInvoices as invoice (invoice.id)}
            <tr class="hover:bg-emerald-500/[0.03] transition-all duration-300 group">
              <td class="p-6 px-10">
                  <span class="font-mono text-[11px] text-emerald-500 group-hover:text-emerald-400 transition-colors uppercase italic font-black underline decoration-emerald-500/20">{invoice.invoiceNumber}</span>
              </td>
              <td class="p-6">
                <div class="flex flex-col gap-1.5">
                  <span class="text-xs font-black text-white uppercase italic tracking-wider group-hover:text-emerald-400 transition-colors">{invoice.supplierName}</span>
                  <span class="text-[9px] text-white/10 uppercase tracking-widest font-black italic">{invoice.supplierId}</span>
                </div>
              </td>
              <td class="p-6 text-right">
                <span class="text-xs font-black text-emerald-500 italic tabular-nums">{formatMMK(invoice.totalAmount)}</span>
              </td>
              <td class="p-6">
                  <span class="text-[10px] font-black text-white/20 uppercase italic tracking-widest group-hover:text-white/40 transition-colors">{new Date(invoice.purchaseDate).toLocaleDateString()}</span>
              </td>
              <td class="p-6">
                <div class="flex items-center gap-3">
                  <div class="h-1.5 w-1.5 rounded-full {invoice.status === 'COMPLETED' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]'}"></div>
                  <span class="text-[9px] font-black uppercase tracking-[0.2em] italic {invoice.status === 'COMPLETED' ? 'text-emerald-500' : 'text-amber-500'}">
                    {invoice.status}
                  </span>
                </div>
              </td>
              <td class="p-6 text-right px-10">
                <button class="px-5 py-2.5 glass-panel bg-white/5 text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all italic">
                  VIEW_DETAIL_NODES
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if purchaseStore.allInvoices.length === 0}
      <div class="p-40 text-center flex flex-col items-center justify-center opacity-10">
        <div class="w-24 h-24 mb-6 border-2 border-white/10 rounded-full flex items-center justify-center">
           <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <p class="text-sm font-black uppercase tracking-[0.5em] italic">No procurement vectors found in local registry</p>
      </div>
    {/if}
  </div>
</div>

<!-- Immersive Modal Portal -->
{#if showModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10 bg-zinc-950/90 backdrop-blur-xl" in:fade>
    <div class="glass-panel w-full max-w-lg border-t-4 border-emerald-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] animate-in zoom-in duration-500">
      <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
        <div>
          <h2 class="text-xl font-black uppercase italic tracking-tighter text-white">Register_Purchase_Entry</h2>
          <p class="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mt-1">Procurement verification protocol : v4.2</p>
        </div>
        <button type="button" class="h-10 w-10 glass-panel flex items-center justify-center text-white/20 hover:text-white hover:bg-rose-500/20 transition-all font-black text-lg" onclick={() => showModal = false}>✕</button>
      </div>
      
      <div class="p-10 space-y-8">
        <div class="space-y-3">
          <label for="pur-invoice" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Voucher_Identifier</label>
          <input id="pur-invoice" type="text" placeholder="SKU_REF_000" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none uppercase italic tracking-[0.2em] transition-all" bind:value={formData.invoiceNumber} />
        </div>
        
        <div class="space-y-3">
          <label for="pur-supplier" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Supplier_Nexus</label>
          <div class="relative">
            <select id="pur-supplier" class="w-full bg-zinc-900 border border-white/10 p-4 text-[10px] font-black text-white focus:border-emerald-500/50 outline-none appearance-none uppercase tracking-[0.2em] transition-all cursor-pointer" bind:value={formData.supplierId}>
              <option value="" class="bg-[#0a0a0a]">Select_Verified_Partner...</option>
              {#each purchaseStore.allSuppliers as supplier}
                <option value={supplier.id} class="bg-[#0a0a0a] uppercase">{supplier.name}</option>
              {/each}
            </select>
            <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 italic">▼</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-8">
          <div class="space-y-3">
            <label for="pur-amount" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Capital_Outlay (Ks)</label>
            <input id="pur-amount" type="number" class="w-full bg-zinc-900 border border-white/10 p-4 text-lg font-black text-emerald-500 focus:border-emerald-500 outline-none tabular-nums italic transition-all" bind:value={formData.totalAmount} />
          </div>
          <div class="space-y-3">
            <label for="pur-date" class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Entry_Timestamp</label>
            <input id="pur-date" type="date" class="w-full bg-zinc-900 border border-white/10 p-4 text-xs font-black text-white focus:border-emerald-500 transition-all invert brightness-200" bind:value={formData.purchaseDate} />
          </div>
        </div>

        <div class="space-y-4">
          <span class="text-[10px] font-black uppercase text-white/30 tracking-widest italic ml-1">Settlement_Status_Vector</span>
          <div class="grid grid-cols-2 gap-4">
            {#each ['PENDING', 'COMPLETED'] as status}
              <button 
                type="button"
                onclick={() => (formData.status = status as any)}
                class="py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border italic {formData.status === status ? 'bg-emerald-500 text-white border-emerald-500 shadow-xl shadow-emerald-500/20' : 'bg-white/5 text-white/30 border-white/5 hover:bg-white/10 hover:text-white'}"
              >
                {status}_SIG
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="p-8 bg-white/5 border-t border-white/5 flex justify-end gap-6">
        <button type="button" class="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-colors italic" onclick={() => showModal = false}>ABORT_OPERATION</button>
        <button type="button" class="glass-button primary px-12 py-4 text-[10px] font-black italic shadow-2xl shadow-emerald-500/20" onclick={handleAdd}>COMMIT_INVOICE_STATE</button>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
    @reference "tailwindcss";
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
    
    .scrollbar-thin::-webkit-scrollbar {
        width: 4px;
        height: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
    .scrollbar-thin::-webkit-scrollbar-thumb { @apply bg-white/10 rounded-full hover:bg-emerald-500/30; }
</style>
