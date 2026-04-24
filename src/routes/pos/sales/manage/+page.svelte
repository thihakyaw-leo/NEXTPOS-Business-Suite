<script lang="ts">
  import { sales } from '$lib/stores/sales.svelte';
  import { formatMMK } from '$lib/types/index';
  import { ui } from '$lib/stores/ui.svelte';
  import { fade, slide } from 'svelte/transition';

  let totalSaleAmount = $derived(sales.all.reduce((s, o) => s + o.netAmount, 0));
  let totalPaidAmount = $derived(sales.all.reduce((s, o) => s + (o.netAmount - ((o as any).notes?.includes('DUE') ? 5000 : 0)), 0)); // Mock logic for paid vs due

  function getStatusStyle(status: string) {
    if (status === 'COMPLETED') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (status === 'CANCELLED') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
</script>

<svelte:head>
  <title>Sales Intelligence | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 space-y-8" in:fade>
  <!-- Header Section -->
  <header class="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>

    <div class="space-y-1 relative max-w-3xl">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">Operational_Status: MISSION_READY</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Sales <span class="text-emerald-500">Intelligence</span>
      </h1>
      <div class="mt-4">
         <p class="text-xs font-black text-white/40 uppercase tracking-widest italic leading-relaxed">
            RetailersPOS is a worthy solution while planning smarter sales strategies. 
            Analyze performance by product, category, and store location. Identify top-selling items, 
            recognize patterns in customer behavior, and make valuable decisions.
         </p>
      </div>
      
      <!-- Rapid Access Nodes -->
      <div class="flex flex-wrap gap-4 mt-6">
         {#each ['Generate Quotes', 'GUI POS', 'POS Billing', 'Manage Drafts', 'POS Terminal', 'Payments'] as node}
            <span class="px-4 py-1.5 glass-panel border-none bg-white/5 text-[8px] font-black uppercase italic tracking-widest text-white/40 group hover:text-emerald-500 transition-colors cursor-default">
               <span class="text-emerald-500 mr-2">/</span> {node}
            </span>
         {/each}
      </div>
    </div>
    
    <div class="flex gap-4 relative">
        <button class="glass-button secondary px-8 py-4 text-[10px] font-black italic tracking-widest">
            GENERATE_STRATEGY_REPORT
        </button>
        <a href="/pos/terminal" class="glass-button primary px-10 py-4 text-[10px] font-black italic tracking-widest shadow-[0_0_40px_rgba(34,197,94,0.15)] flex items-center gap-3">
            <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span> INITIALIZE_TERMINAL
        </a>
    </div>
  </header>

  <!-- Performance Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="glass-panel p-6 border-l-4 border-l-emerald-500">
        <div class="flex items-center justify-between mb-4">
            <span class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Gross Revenue</span>
            <div class="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
        </div>
        <div class="space-y-1">
            <p class="text-3xl font-black text-white italic tabular-nums">{formatMMK(totalSaleAmount)}</p>
            <p class="text-[10px] font-bold text-emerald-500/60 uppercase">System Aggregated Total</p>
        </div>
    </div>

    <div class="glass-panel p-6 border-l-4 border-l-blue-500">
        <div class="flex items-center justify-between mb-4">
            <span class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Liquid Assets</span>
            <div class="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
        </div>
        <div class="space-y-1">
            <p class="text-3xl font-black text-white italic tabular-nums">{formatMMK(totalPaidAmount)}</p>
            <p class="text-[10px] font-bold text-blue-500/60 uppercase">Settled Cashflow</p>
        </div>
    </div>

    <div class="glass-panel p-6 border-l-4 border-l-rose-500">
        <div class="flex items-center justify-between mb-4">
            <span class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Outstanding Debt</span>
            <div class="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
        </div>
        <div class="space-y-1">
            <p class="text-3xl font-black text-white italic tabular-nums">{formatMMK(totalSaleAmount - totalPaidAmount)}</p>
            <p class="text-[10px] font-bold text-rose-500/60 uppercase">Pending Collection</p>
        </div>
    </div>
  </div>

  <!-- Transaction Audit Center -->
  <div class="glass-panel overflow-hidden border-t-4 border-t-zinc-800">
    <div class="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5">
        <div class="flex items-center gap-4">
            <div class="h-10 w-1 bg-emerald-500 rounded-full"></div>
            <div>
                <h2 class="text-xs font-black text-white uppercase tracking-[0.2em]">Transaction Audit Trail</h2>
                <p class="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">High-Precision Ledger Tracking</p>
            </div>
        </div>
        
        <div class="flex items-center gap-2">
            <div class="relative group">
                <input 
                    type="text" 
                    placeholder="SCAN INVOICE OR SEARCH..." 
                    class="bg-zinc-900/50 border border-white/10 px-8 py-2 text-[10px] font-bold text-white uppercase tracking-widest focus:border-emerald-500/50 outline-none transition-all w-64 italic placeholder:text-white/20"
                />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-white/20">🔍</span>
            </div>
            <button class="bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/10 p-2 transition-all group">
                <span class="sr-only">Filters</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:rotate-180 transition-transform"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </button>
        </div>
    </div>

    <div class="overflow-x-auto overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-emerald-500/20">
      <table class="w-full text-left border-collapse">
        <thead class="sticky top-0 bg-zinc-900 border-b border-white/10 z-10">
          <tr class="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] italic">
            <th class="p-5 font-black">Control</th>
            <th class="p-5">Audit Timestamp</th>
            <th class="p-5">Reference No.</th>
            <th class="p-5 text-right">Net Value</th>
            <th class="p-5 text-right">Asset Inbound</th>
            <th class="p-5 text-right">Libility</th>
            <th class="p-5">Operational Status</th>
            <th class="p-5">Registry Type</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          {#each sales.all as sale (sale.id)}
            <tr class="group hover:bg-emerald-500/[0.03] transition-all duration-300">
              <td class="p-5">
                 <div class="flex gap-2">
                    <button class="glass-button secondary p-1.5 px-3 text-[9px] group-hover:border-white/20">VIEW</button>
                    <button class="glass-button emerald p-1.5 px-3 text-[9px]">SYNC</button>
                 </div>
              </td>
              <td class="p-5">
                  <div class="flex flex-col">
                      <span class="text-xs font-black text-white italic">{new Date(sale.saleDate).toLocaleDateString()}</span>
                      <span class="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Verified UTC</span>
                  </div>
              </td>
              <td class="p-5 font-black text-emerald-400 font-mono tracking-tighter">{sale.saleNumber}</td>
              <td class="p-5 text-right">
                  <span class="text-xs font-black text-white italic tabular-nums">{formatMMK(sale.netAmount)}</span>
              </td>
              <td class="p-5 text-right">
                  <span class="text-xs font-bold text-white/60 tabular-nums">{formatMMK(sale.netAmount)}</span>
              </td>
              <td class="p-5 text-right">
                  <span class="text-xs font-black text-rose-500 tabular-nums italic">0 KS</span>
              </td>
              <td class="p-5 text-[9px]">
                 <span class="px-3 py-1 font-black uppercase border rounded-sm {getStatusStyle(sale.status)} tracking-widest">
                    {sale.status}
                 </span>
              </td>
              <td class="p-5">
                 <span class="text-[9px] font-black uppercase text-white/20 tracking-[0.3em]">RETAIL_FLOW</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if sales.all.length === 0}
         <div class="p-32 flex flex-col items-center justify-center opacity-20 group">
            <div class="h-20 w-20 border-2 border-dashed border-white/50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
            </div>
            <p class="text-sm font-black uppercase tracking-[0.5em] italic">Vault is Empty</p>
            <p class="text-[10px] font-bold mt-2 tracking-widest">No transaction telemetry detected</p>
         </div>
      {/if}
    </div>

    <!-- Ledger Pagination -->
    <footer class="p-5 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-zinc-900/40">
       <div class="flex items-center gap-6">
           <div class="flex items-center gap-3">
               <span class="text-[9px] font-black text-white/20 uppercase tracking-widest italic">Buffer Density</span>
               <select class="bg-zinc-900 border border-white/10 p-1.5 px-3 text-[9px] font-black text-emerald-500 outline-none focus:border-emerald-500 transition-all uppercase tracking-widest appearance-none cursor-pointer">
                   <option>10 ROWS</option>
                   <option>25 ROWS</option>
                   <option>50 ROWS</option>
               </select>
           </div>
           <p class="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] italic">System Registry Status: 0 Transaction Points Connected</p>
       </div>
       
       <div class="flex gap-2">
          <button class="glass-button secondary px-4 py-2 text-[9px] opacity-40">PREV_INDEX</button>
          <button class="glass-button emerald px-4 py-2 text-[9px]">NEXT_INDEX</button>
       </div>
    </footer>
  </div>
</div>

<style lang="postcss">
    @reference "tailwindcss";
    .glass-panel {
        @apply bg-[#111111]/80 backdrop-blur-xl border border-white/5 shadow-2xl;
    }

    .glass-button {
        @apply border uppercase tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed;
    }

    .glass-button.primary {
        @apply bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)];
    }

    .glass-button.secondary {
        @apply bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20;
    }

    .glass-button.emerald {
        @apply bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-emerald-500;
    }

    /* Custom Scrollbar for high-density feel */
    .scrollbar-thin::-webkit-scrollbar {
        width: 4px;
        height: 4px;
    }

    .scrollbar-thin::-webkit-scrollbar-track {
        @apply bg-transparent;
    }

    .scrollbar-thin::-webkit-scrollbar-thumb {
        @apply bg-emerald-500/20 rounded-full hover:bg-emerald-500/40 transition-colors;
    }
</style>

