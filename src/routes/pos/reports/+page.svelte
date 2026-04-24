<script lang="ts">
  import { Line } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
  } from 'chart.js';
  import { sales, type DateFilter } from '$lib/stores/sales.svelte';
  import { purchaseStore } from '$lib/stores/purchaseStore.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { formatMMK } from '$lib/types/index';
  import { fade, slide, scale } from 'svelte/transition';
  import { exportSalesPDF, exportSalesExcel, exportPurchasePDF, exportPurchaseExcel } from '$lib/utils/export';

  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

  let activeFilter: DateFilter = $state('today');
  let activeView = $state('hub');
  let exporting = $state(false);

  async function handleExport(type: 'sales-pdf' | 'sales-excel' | 'purchase-pdf' | 'purchase-excel') {
    exporting = true;
    try {
      const label = activeFilter === 'today' ? 'Today' : activeFilter === 'week' ? 'This Week' : activeFilter === 'month' ? 'This Month' : 'All Time';
      if (type === 'sales-pdf')     await exportSalesPDF(sales.filtered, label);
      if (type === 'sales-excel')   await exportSalesExcel(sales.filtered, label);
      if (type === 'purchase-pdf')  await exportPurchasePDF(purchaseStore.allInvoices);
      if (type === 'purchase-excel') await exportPurchaseExcel(purchaseStore.allInvoices);
    } finally {
      exporting = false;
    }
  }

  const reportCategories = [
    { id: 'sales', name: 'Sales Report Analysis', icon: '📈', desc: 'Deep dive into revenue patterns, item velocity, and invoice trends.', color: 'border-emerald-500/30', stats: 'Live_Metrics', glow: 'shadow-emerald-500/10' },
    { id: 'purchase', name: 'Purchase Report Analysis', icon: '🛒', desc: 'Optimize procurement costs and supplier efficiency tracking.', color: 'border-blue-500/30', stats: 'Procure_Audit', glow: 'shadow-blue-500/10' },
    { id: 'outlet', name: 'Outlet Report Analysis', icon: '🏛️', desc: 'Analyze performance metrics across various store locations.', color: 'border-indigo-500/30', stats: 'Location_Parity', glow: 'shadow-indigo-500/10' },
    { id: 'stock', name: 'Stock Alert Report', icon: '⚠️', desc: 'Automated monitoring of critical low-stock and reorder vectors.', color: 'border-amber-500/30', stats: '12 Low', glow: 'shadow-amber-500/10' },
    { id: 'expiration', name: 'Product Expiration Reports', icon: '⌛', desc: 'Track batch lifespan and aging profiles to mitigate wastage.', color: 'border-rose-500/30', stats: 'Quality_Ctrl', glow: 'shadow-rose-500/10' },
    { id: 'customers', name: 'Customer Activity Hub', icon: '🤝', desc: 'Loyalty points, purchase history, and behavior patterns.', color: 'border-sky-500/30', stats: '1.2k Total', glow: 'shadow-sky-500/10' },
  ];

  let revenue = $derived(sales.totalRevenue);
  let count = $derived(sales.totalCount);
  let aov = $derived(sales.avgSale);
  let trendDataRaw = $derived(sales.last7DaysTrend());
  
  let trendChartData = $derived({
    labels: trendDataRaw.map((day) => day.label),
    datasets: [
      {
        fill: true,
        label: 'Revenue Growth',
        data: trendDataRaw.map((day) => day.value),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
        borderWidth: 3,
        pointBackgroundColor: '#22c55e',
        pointBorderColor: 'rgba(255,255,255,0.1)',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4,
      },
    ],
  });

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0a0a0a',
        titleFont: { size: 10, weight: '900' },
        bodyFont: { size: 12, weight: '700' },
        padding: 12,
        cornerRadius: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { color: 'rgba(255,255,255,0.03)' }, 
        ticks: { color: 'rgba(255,255,255,0.2)', font: { size: 9, family: 'monospace', weight: '900' } } 
      },
      x: { 
        grid: { display: false }, 
        ticks: { color: 'rgba(255,255,255,0.2)', font: { size: 9, family: 'monospace', weight: '900' } } 
      }
    }
  };

  function setDateFilter(f: DateFilter) {
    activeFilter = f;
    sales.setDateFilter(f);
  }
</script>

<svelte:head>
  <title>Reporting Intelligence | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- Global Telemetry Header -->
  <header class="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>

    <div class="space-y-1 relative max-w-4xl">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">Telemetry_Analysis: OPTIMIZED</span>
      </div>
      <h1 class="text-4xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Report <span class="text-emerald-500">Analysis</span>
      </h1>
      <div class="mt-4">
         <p class="text-xs font-black text-white/40 uppercase tracking-widest italic leading-relaxed">
            RetailersPOS provides you the deeper insight to overcome failings of your business. 
            From sales patterns and product movement to inventory costs and customer activity you can get everything from one platform.
         </p>
      </div>
      
      <!-- Rapid Access Filters -->
      <div class="flex gap-2 mt-6">
        {#each ['today', 'week', 'month', 'all'] as filter}
          <button 
            onclick={() => setDateFilter(filter as DateFilter)}
            class="px-6 py-2 glass-panel border-none text-[8px] font-black uppercase italic tracking-widest transition-all {activeFilter === filter ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/20 hover:text-white'}"
          >
            {filter}
          </button>
        {/each}
      </div>
    </div>

    <!-- Export Actions -->
    <div class="flex flex-col gap-3 relative shrink-0">
      <div class="glass-panel p-1 flex border-white/10">
        {#each ['today', 'week', 'month', 'all'] as filter}
          <button 
            onclick={() => setDateFilter(filter as DateFilter)}
            class="px-6 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all {activeFilter === filter ? 'bg-emerald-500 text-white' : 'text-white/20 hover:text-white'}"
          >
            {filter}
          </button>
        {/each}
      </div>
      <div class="flex gap-2">
        <button onclick={() => handleExport('sales-pdf')} disabled={exporting} class="glass-button secondary px-5 py-2.5 text-[9px] flex items-center gap-2">
          <span>📄</span> SALES PDF
        </button>
        <button onclick={() => handleExport('sales-excel')} disabled={exporting} class="glass-button secondary px-5 py-2.5 text-[9px] flex items-center gap-2">
          <span>📊</span> SALES XLS
        </button>
        <button onclick={() => handleExport('purchase-pdf')} disabled={exporting} class="glass-button secondary px-5 py-2.5 text-[9px] flex items-center gap-2">
          <span>📋</span> PURCHASE PDF
        </button>
      </div>
    </div>
  </header>

  {#if activeView === 'hub'}
    <!-- Intelligence Hub: Data Mesh -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" in:fade>
      {#each reportCategories as cat}
        <button 
          onclick={() => activeView = cat.id}
          class="glass-panel p-10 text-left hover:border-white/20 transition-all group relative overflow-hidden flex flex-col h-full border-t-2 {cat.color} {cat.glow}"
        >
          <div class="absolute -top-10 -right-10 w-40 h-40 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity blur-3xl rounded-full"></div>
          
          <div class="flex justify-between items-start mb-10">
            <div class="w-16 h-16 glass-panel flex items-center justify-center text-3xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">{cat.icon}</div>
            <span class="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-3 py-1.5 border border-emerald-500/20 tracking-widest">{cat.stats}</span>
          </div>
          
          <div class="flex-1">
              <h3 class="text-lg font-black text-white uppercase tracking-wider mb-4 group-hover:text-emerald-400 transition-colors italic">{cat.name}</h3>
              <p class="text-[11px] text-white/40 leading-relaxed font-bold uppercase tracking-tight">{cat.desc}</p>
          </div>
          
          <div class="mt-10 flex items-center gap-3 text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em] opacity-30 group-hover:opacity-100 transition-all">
             DEPLOY TELEMETRY
             <svg class="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </div>
        </button>
      {/each}
    </div>

    <!-- Real-time KPI Matrix -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12" in:fade>
      <div class="glass-panel p-6 border-l-4 border-l-emerald-500">
         <p class="text-[9px] font-black uppercase text-white/20 tracking-[0.3em] mb-2">Aggregated Yield</p>
         <p class="text-2xl font-black text-white italic tabular-nums">{formatMMK(revenue)}</p>
      </div>
      <div class="glass-panel p-6 border-l-4 border-l-blue-500">
         <p class="text-[9px] font-black uppercase text-white/20 tracking-[0.3em] mb-2">Registry Volume</p>
         <p class="text-2xl font-black text-white italic tabular-nums">{count} <span class="text-[10px] opacity-20 not-italic">ENTRIES</span></p>
      </div>
      <div class="glass-panel p-6 border-l-4 border-l-amber-500">
         <p class="text-[9px] font-black uppercase text-white/20 tracking-[0.3em] mb-2">Mean Transaction Value</p>
         <p class="text-2xl font-black text-white italic tabular-nums">{formatMMK(aov)}</p>
      </div>
      <div class="glass-panel p-6 border-l-4 border-l-rose-500">
         <p class="text-[9px] font-black uppercase text-white/20 tracking-[0.3em] mb-2">Efficiency Rating</p>
         <p class="text-2xl font-black text-emerald-500 italic tabular-nums">98.4%</p>
      </div>
    </div>

  {:else}
    <!-- Detail Analytics Module -->
    <div class="space-y-8" in:fade>
       <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="lg:col-span-2 glass-panel overflow-hidden">
            <div class="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div class="flex items-center gap-3">
                    <div class="h-6 w-1 bg-emerald-500 rounded-full"></div>
                    <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">Vector Visualization</h3>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span class="text-[9px] font-black text-white/40 uppercase tracking-widest">Live Feed</span>
                </div>
            </div>
            <div class="p-10 h-[500px]">
               <Line data={trendChartData} options={chartOptions} />
            </div>
          </div>
          
          <div class="glass-panel flex flex-col border-t-2 border-emerald-500/50">
             <div class="p-6 border-b border-white/5">
               <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">Audit Synthesis</h3>
             </div>
             <div class="p-8 flex-1 space-y-10">
                <div class="space-y-2">
                   <p class="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1 italic">Closing Telemetry Balance</p>
                   <p class="text-4xl font-black text-white italic tabular-nums tracking-tighter">{formatMMK(revenue)}</p>
                   <p class="text-[9px] font-bold text-emerald-500 uppercase tracking-[0.2em]">Verified Secure Transaction</p>
                </div>
                
                <div class="space-y-4">
                   <div class="flex justify-between items-end">
                       <p class="text-[10px] font-black uppercase text-white/20 tracking-widest">Performance Velo</p>
                       <p class="text-xs font-black text-emerald-400">88.4%</p>
                   </div>
                   <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div class="bg-emerald-500 h-full shadow-[0_0_15px_rgba(34,197,94,0.5)]" style="width: 88.4%"></div>
                   </div>
                   <p class="text-[9px] text-white/20 font-bold uppercase tracking-[0.3em] italic">System operational at peak capacity</p>
                </div>

                <div class="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-sm">
                    <p class="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-3">AI Prediction Index</p>
                    <p class="text-xs font-bold text-white/60 leading-relaxed uppercase tracking-tighter italic">"Projected 12.4% growth in next cycle based on inventory velocity and seasonal trends."</p>
                </div>
             </div>
             
             <div class="p-8 bg-white/5 border-t border-white/5 flex gap-3">
                <button onclick={() => handleExport('sales-pdf')} disabled={exporting} class="flex-1 glass-button primary py-4 text-[9px] font-black flex items-center justify-center gap-2">
                  <span>📄</span> EXPORT_PDF
                </button>
                <button onclick={() => handleExport('sales-excel')} disabled={exporting} class="flex-1 glass-button secondary py-4 text-[9px] font-black flex items-center justify-center gap-2">
                  <span>📊</span> EXPORT_EXCEL
                </button>
             </div>
          </div>
       </div>
       
       <!-- Secondary Data Strip -->
       <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
           {#each [1,2,3] as i}
           <div class="glass-panel p-6 flex items-center justify-between group">
               <div>
                   <p class="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1 italic">Sub-Vector {i}</p>
                   <p class="text-lg font-black text-white italic tabular-nums">{formatMMK(revenue / (i * 2))}</p>
               </div>
               <div class="h-10 w-10 glass-panel flex items-center justify-center opacity-20 group-hover:opacity-100 transition-opacity">
                   <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
               </div>
           </div>
           {/each}
       </div>
    </div>
  {/if}
</div>

<style lang="postcss">
    @reference "tailwindcss";
    .glass-panel {
        @apply bg-[#111111]/80 backdrop-blur-xl border border-white/5 shadow-2xl;
    }

    .glass-button {
        @apply border rounded-sm uppercase tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed;
    }

    .glass-button.primary {
        @apply bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)];
    }

    .glass-button.secondary {
        @apply bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20;
    }

    .glass-button.emerald {
        @apply bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-emerald-500;
    }
</style>
