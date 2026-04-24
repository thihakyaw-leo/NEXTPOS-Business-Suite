<script lang="ts">
  import { formatMMK } from '$lib/types/index';
  import { fade, slide, scale } from 'svelte/transition';
  import { sales } from '$lib/stores/sales.svelte';
  import { purchaseStore } from '$lib/stores/purchaseStore.svelte';

  const todayKey = new Date().toISOString().slice(0, 10);
  
  // Financial Metrics
  let totalRevenue = $derived(sales.all.reduce((s, o) => s + o.netAmount, 0));
  let totalExpense = $derived(purchaseStore.allInvoices.reduce((s, i) => s + i.totalAmount, 0));
  let netProfit = $derived(totalRevenue - totalExpense);

  const features = [
    { id: 'fiscal', title: 'Fiscal Year Management', icon: '📅' },
    { id: 'reports', title: 'Financial Reports', icon: '📊' },
    { id: 'chart', title: 'Chart of Accounts', icon: '🗂️' },
    { id: 'vouchers', title: 'Voucher Management', icon: '🎫' },
    { id: 'predefine', title: 'Predefine Accounts Options', icon: '⚙️' },
    { id: 'ledger', title: 'Detailed Ledger Summary', icon: '📖' }
  ];
</script>

<svelte:head>
  <title>Financial Intelligence | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- Financial Header -->
  <header class="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>

    <div class="space-y-1 relative max-w-4xl">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">Accounting_Engine: ENCRYPTED_&_STABLE</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Financial <span class="text-emerald-500">Intelligence</span>
      </h1>
      <div class="mt-4">
         <p class="text-xs font-black text-white/40 uppercase tracking-widest italic leading-relaxed">
            Stay compliant and confident with accounting modules introduced for retail. 
            RetailersPOS lets you manage your general ledger, payment records, and expense tracking with detailed reports.
         </p>
      </div>
      
      <!-- Feature Nodes -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
         {#each features as feature}
            <div class="glass-panel p-4 flex flex-col gap-3 group hover:border-emerald-500/30 transition-all cursor-pointer">
                <span class="text-xl group-hover:scale-110 transition-transform duration-500">{feature.icon}</span>
                <span class="text-[8px] font-black uppercase text-white/40 group-hover:text-white transition-colors tracking-widest italic leading-tight">
                    {feature.title}
                </span>
            </div>
         {/each}
      </div>
    </div>
    
    <div class="flex gap-4 relative">
       <button type="button" class="glass-button secondary px-8 py-4 text-[10px] font-black italic tracking-widest">
         GENERATE_FISCAL_AUDIT
       </button>
    </div>
  </header>

  <!-- Financial Telemetry -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
    <div class="glass-panel p-8 border-t-2 border-emerald-500/30">
        <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Operational_Revenue</p>
        <p class="text-4xl font-black text-white italic tabular-nums leading-none tracking-tighter">{formatMMK(totalRevenue)}</p>
    </div>
    <div class="glass-panel p-8 border-t-2 border-rose-500/30">
        <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Total_Expenditure</p>
        <p class="text-4xl font-black text-white italic tabular-nums leading-none tracking-tighter">{formatMMK(totalExpense)}</p>
    </div>
    <div class="glass-panel p-8 border-t-2 border-blue-500/30">
        <p class="text-[10px] uppercase font-black text-white/30 tracking-widest mb-4 italic">Net_Liquidity_Position</p>
        <p class="text-4xl font-black text-emerald-500 italic tabular-nums leading-none tracking-tighter">{formatMMK(netProfit)}</p>
    </div>
  </div>

  <!-- Recent Ledger Entries -->
  <div class="glass-panel overflow-hidden border-t-2 border-zinc-800">
    <div class="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
      <div>
        <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">General Ledger Pulse</h3>
        <p class="text-[9px] text-white/20 mt-1 font-black uppercase tracking-widest italic font-bold">Encrypted Financial Audit Trail Active</p>
      </div>
    </div>
    
    <div class="p-20 text-center flex flex-col items-center justify-center opacity-10">
        <div class="w-20 h-20 mb-6 border-2 border-white/10 rounded-full flex items-center justify-center text-3xl">🏦</div>
        <p class="text-sm font-black uppercase tracking-[0.5em] italic">Universal Ledger Sync Required</p>
        <p class="text-[9px] font-black uppercase tracking-widest mt-4">Connect to Bank Nexus for live telemetry</p>
    </div>
  </div>
</div>

<style lang="postcss">
    @reference "tailwindcss";
    .glass-panel {
        @apply bg-[#111111]/80 backdrop-blur-xl border border-white/5 shadow-2xl;
    }

    .glass-button {
        @apply border rounded-sm uppercase tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed;
    }

    .glass-button.secondary {
        @apply bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20;
    }
</style>
