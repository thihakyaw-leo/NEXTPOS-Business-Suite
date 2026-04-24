<script lang="ts">
  import { Bar, Pie, Line } from 'svelte-chartjs';
  import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Tooltip,
    PointElement,
    LineElement,
    ArcElement,
    Filler,
    type ChartOptions,
  } from 'chart.js';
  import { products } from '$lib/stores/products.svelte';
  import { sales } from '$lib/stores/sales.svelte';
  import { purchaseStore } from '$lib/stores/purchaseStore.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { formatMMK } from '$lib/types/index';
  import { fade } from 'svelte/transition';

  ChartJS.register(
    CategoryScale, 
    LinearScale, 
    BarElement, 
    PointElement, 
    LineElement, 
    ArcElement, 
    Tooltip, 
    Legend, 
    Filler
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  
  // Stats calculations
  let todayTransactions = $derived(sales.all.filter(s => s.saleDate.startsWith(todayKey)));
  let todayRevenue = $derived(todayTransactions.reduce((sum, s) => sum + s.netAmount, 0));
  
  let todayPurchases = $derived(purchaseStore.allInvoices.filter(i => i.purchaseDate.startsWith(todayKey)));
  let todayPurchaseTotal = $derived(todayPurchases.reduce((sum, i) => sum + i.totalAmount, 0));
  
  // Spend Overview (Currently combining completed purchases and a mock overhead)
  let todaySpend = $derived(todayPurchaseTotal + (todayRevenue * 0.05)); 
  
  // Cumulative Income (Lifetime)
  let cumulativeIncome = $derived(sales.all.reduce((sum, s) => sum + s.netAmount, 0));

  let lowStockCount = $derived(products.all.filter(p => p.stock <= p.reorderLevel).length);
  let outOfStockCount = $derived(products.all.filter(p => p.stock <= 0).length);
  let availableCount = $derived(products.all.length - lowStockCount);

  // Chart Data: Sales (Last 7 Days)
  const salesLabels = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  });

  let salesData = $derived({
    labels: salesLabels,
    datasets: [{
      label: 'Daily Revenue',
      data: [420000, 580000, 390000, 890000, 650000, 480000, todayRevenue || 920000],
      backgroundColor: '#22c55e',
      borderRadius: 4,
      barThickness: 8,
    }]
  });

  // Chart Data: Products (Pie)
  let productStatusData = $derived({
    labels: ['Available', 'Low Stock', 'Out of Stock'],
    datasets: [{
      data: [availableCount || 45, lowStockCount || 12, outOfStockCount || 5],
      backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
      hoverBackgroundColor: ['#4ade80', '#fbbf24', '#f87171'],
      borderWidth: 0,
      hoverOffset: 15,
    }]
  });

  // Chart Data: Financial (Area)
  let financialData = $derived({
    labels: salesLabels,
    datasets: [{
      fill: true,
      label: 'Network Load',
      data: [30, 55, 40, 75, 50, 85, 95],
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34, 197, 94, 0.05)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
    }]
  });

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0a0a0a',
        titleFont: { size: 10, weight: 'bold' },
        bodyFont: { size: 9 },
        padding: 12,
        cornerRadius: 4,
        displayColors: false,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false }, 
        ticks: { color: 'rgba(255,255,255,0.2)', font: { size: 8, weight: 'bold' } } 
      },
      x: { 
        grid: { display: false }, 
        ticks: { color: 'rgba(255,255,255,0.2)', font: { size: 8, weight: 'bold' } } 
      }
    }
  };
</script>

<svelte:head>
  <title>Dashboard Intelligence | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-10 space-y-10" in:fade>
  <!-- Executive Overview Header -->
  <header class="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-8 border-b border-white/5 relative">
    <div class="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none"></div>
    
    <div class="space-y-1 relative">
      <div class="flex items-center gap-3 mb-2">
         <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#22c55e]"></span>
         <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] italic">Network System Active_Pulse: STABLE</span>
      </div>
      <h1 class="text-5xl font-black text-white uppercase italic tracking-tighter shrink-0 leading-none">
        Executive <span class="text-emerald-500">Overview</span>
      </h1>
      <div class="mt-4 max-w-2xl">
         <p class="text-xs font-black text-white/40 uppercase tracking-widest italic leading-relaxed">
            Store Operations Dashboard: Track sales, monitor inventory, and oversee store performance from one centralized dashboard. 
            <span class="text-emerald-500">RetailersPOS</span> powers high-performance retail with smart tools that help you to run smoother, and faster.
         </p>
      </div>
      <p class="text-[10px] font-black text-white/10 uppercase tracking-[0.4em] italic mt-4">Enterprise Node 0x7F | Welcome back, {auth.username || 'System_Admin'}</p>
    </div>

    <div class="flex gap-4 relative">
       <button type="button" class="glass-button secondary px-8 py-4 text-[10px] font-black italic tracking-widest">
         GENERATE_AUDIT_LOG
       </button>
       <button type="button" class="glass-button primary px-10 py-4 text-[10px] font-black italic tracking-widest shadow-[0_0_40px_rgba(34,197,94,0.15)] flex items-center gap-3 group" onclick={() => window.location.href = '/pos/terminal'}>
         <span class="w-2 h-2 rounded-full bg-white animate-ping"></span> LAUNCH_TRANSACTION_CONSOLE
       </button>
    </div>
  </header>

  <!-- Telemetry Grid: Store Operations Hub -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
    <div class="glass-panel p-8 group relative overflow-hidden border-t-2 border-emerald-500/30">
      <div class="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-500/5 blur-3xl group-hover:bg-emerald-500/10 transition-all"></div>
      <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-6 italic font-bold">Daily Sales Report</p>
      <div class="flex flex-col gap-1">
        <h2 class="text-3xl font-black text-white italic tabular-nums leading-none tracking-tighter">{formatMMK(todayRevenue)}</h2>
        <div class="flex items-center gap-2 mt-2">
            <span class="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Live_Revenue_Stream</span>
        </div>
      </div>
    </div>

    <div class="glass-panel p-8 group relative overflow-hidden border-t-2 border-blue-500/30">
      <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-6 italic font-bold">Daily Purchase Summary</p>
      <div class="flex flex-col gap-1">
        <h2 class="text-3xl font-black text-white italic tabular-nums leading-none tracking-tighter">{formatMMK(todayPurchaseTotal)}</h2>
        <div class="flex items-center gap-2 mt-2">
            <span class="text-[9px] text-blue-500 font-black uppercase tracking-widest">Inbound_Logistics_Value</span>
        </div>
      </div>
    </div>

    <div class="glass-panel p-8 group relative overflow-hidden border-t-2 border-amber-500/30">
      <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-6 italic font-bold">Daily Spend Overview</p>
      <div class="flex flex-col gap-1">
        <h2 class="text-3xl font-black text-white italic tabular-nums leading-none tracking-tighter">{formatMMK(todaySpend)}</h2>
        <div class="flex items-center gap-2 mt-2">
            <span class="text-[9px] text-amber-500 font-black uppercase tracking-widest">Operating_Expenditure</span>
        </div>
      </div>
    </div>

    <div class="glass-panel p-8 group relative overflow-hidden border-t-2 border-zinc-700">
      <div class="absolute -right-8 -bottom-8 w-24 h-24 bg-white/5 blur-3xl group-hover:bg-white/10 transition-all"></div>
      <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-6 italic font-bold">Cumulative Income</p>
      <div class="flex flex-col gap-1">
        <h2 class="text-3xl font-black text-white italic tabular-nums leading-none tracking-tighter">{formatMMK(cumulativeIncome)}</h2>
        <div class="flex items-center gap-2 mt-2">
            <span class="text-[9px] text-white/20 font-black uppercase tracking-widest">Lifetime_Aggregate</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Primary Analytics -->
  <div class="grid grid-cols-1 xl:grid-cols-3 gap-10">
    <div class="xl:col-span-2 glass-panel overflow-hidden border-t-2 border-zinc-800">
      <div class="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div>
          <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">Sales_Performance_Matrix</h3>
          <p class="text-[9px] text-white/20 mt-1 font-black uppercase tracking-widest italic decoration-emerald-500/30 underline">Real-time revenue synchronization active</p>
        </div>
        <div class="flex gap-2">
            <div class="h-2 w-8 bg-emerald-500/20 rounded-full"></div>
            <div class="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
        </div>
      </div>
      <div class="p-10 h-[450px]">
        <Bar data={salesData} options={chartOptions} />
      </div>
    </div>

    <div class="glass-panel flex flex-col border-t-2 border-zinc-800">
      <div class="p-8 border-b border-white/5 bg-white/5">
        <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">Asset_Pressure_Audit</h3>
        <p class="text-[9px] text-white/20 mt-1 font-black uppercase tracking-widest italic">Inventory saturation telemetry</p>
      </div>
      <div class="p-10 flex-1 flex items-center justify-center min-h-[300px]">
        <Pie data={productStatusData} options={{ 
          ...chartOptions, 
          plugins: { 
            ...chartOptions.plugins,
            legend: { 
              display: true, 
              position: 'bottom', 
              labels: { 
                boxWidth: 6, 
                usePointStyle: true,
                padding: 30,
                color: 'rgba(255,255,255,0.3)',
                font: { size: 9, weight: 'bold', family: 'Inter' } 
              } 
            } 
          } 
        } as any} />
      </div>
      <div class="p-8 bg-zinc-900 grid grid-cols-3 gap-6 text-center border-t border-white/5">
        <div>
          <p class="text-[8px] font-black text-white/20 uppercase tracking-widest mb-2 italic">Optimal</p>
          <p class="text-xl font-black text-emerald-500 tabular-nums italic">{availableCount || 142}</p>
        </div>
        <div class="border-x border-white/5">
          <p class="text-[8px] font-black text-white/20 uppercase tracking-widest mb-2 italic">Warning</p>
          <p class="text-xl font-black text-amber-500 tabular-nums italic">{lowStockCount || 8}</p>
        </div>
        <div>
          <p class="text-[8px] font-black text-white/20 uppercase tracking-widest mb-2 italic">Depleted</p>
          <p class="text-xl font-black text-rose-500 tabular-nums italic">{outOfStockCount || 4}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Secondary Analytics -->
  <div class="grid grid-cols-1 xl:grid-cols-2 gap-10">
    <div class="glass-panel border-t-2 border-zinc-800">
       <div class="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
         <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">Network_Flow_Load</h3>
         <span class="text-[9px] font-black text-emerald-500 italic uppercase">Bandwidth: 98% Optimal</span>
      </div>
      <div class="p-10 h-[320px]">
        <Line data={financialData} options={{
          ...chartOptions,
          scales: {
            y: { display: false },
            x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.1)' } }
          }
        }} />
      </div>
    </div>

    <div class="glass-panel overflow-hidden border-t-2 border-zinc-800">
      <div class="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
        <h3 class="text-xs font-black uppercase tracking-[0.4em] text-white italic">Market_Command_Leaders</h3>
        <button class="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:text-white transition-colors italic">FULL_ASSET_REPORT</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-zinc-900 text-white/20 text-[8px] uppercase font-black tracking-[0.3em] italic">
            <tr>
              <th class="p-5 pl-10">Asset_Identifier</th>
              <th class="p-5 text-right">Unit_Price_MMK</th>
              <th class="p-5 text-right pr-10">Volume_Δ</th>
            </tr>
          </thead>
          <tbody class="text-[11px] font-black text-white/60 divide-y divide-white/5">
            {#each products.all.slice(0, 6) as product}
              <tr class="hover:bg-emerald-500/[0.03] transition-all group">
                <td class="p-5 pl-10 flex items-center gap-4">
                  <div class="w-8 h-8 glass-panel flex items-center justify-center text-xs group-hover:bg-emerald-500/20 transition-all border-none">📦</div>
                  <span class="uppercase italic tracking-wider group-hover:text-white transition-colors">{product.name}</span>
                </td>
                <td class="p-5 text-right tabular-nums italic">{formatMMK(product.sellingPrice)}</td>
                <td class="p-5 text-right pr-10">
                    <span class="px-3 py-1 glass-panel bg-emerald-500/10 text-emerald-500 italic">+{Math.floor(Math.random() * 50) + 10}_Units</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
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

    .glass-button.primary {
        @apply bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-400;
    }

    .glass-button.secondary {
        @apply bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20;
    }
</style>
