<svelte:options runes={false} />

<script lang="ts">
  import { Line, Bar } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
  } from 'chart.js';
  import { sales, type DateFilter } from '$lib/stores/sales.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { formatMMK } from '$lib/types/index';

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
  );

  let activeFilter: DateFilter = 'all';

  function setDateFilter(filter: DateFilter) {
    activeFilter = filter;
    sales.setDateFilter(filter);
  }

  // Reactive Stats derived from active timeline
  $: filteredSales = sales.filtered;
  $: revenue = sales.totalRevenue;
  $: count = sales.totalCount;
  $: aov = sales.avgSale;

  // Trend Chart Data (Last 7 Days Revenue Trend)
  $: trendDataRaw = sales.last7DaysTrend();
  $: trendChartData = {
    labels: trendDataRaw.map(d => d.label),
    datasets: [
      {
        label: 'Gross Revenue (MMK)',
        data: trendDataRaw.map(d => d.value),
        borderColor: '#2dd4bf', // teal-400
        backgroundColor: 'rgba(45, 212, 191, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#14b8a6', // teal-500
        pointBorderColor: '#fff',
        pointRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#e2e8f0',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94a3b8' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'Space Grotesk' } }
      }
    }
  };

  // Compute Top Performing Items based on filtered sales
  $: topItems = (() => {
    const itemMap = new Map<string, { qty: number, revenue: number, name: string }>();
    
    for (const sale of filteredSales) {
      if (sale.status !== 'COMPLETED') continue;
      const details = sales.details.get(sale.id) || [];
      for (const d of details) {
        const current = itemMap.get(d.itemCode) || { qty: 0, revenue: 0, name: d.itemName };
        itemMap.set(d.itemCode, {
          qty: current.qty + d.quantity,
          revenue: current.revenue + d.lineTotal,
          name: d.itemName
        });
      }
    }
    
    return Array.from(itemMap.entries())
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  })();

</script>

<svelte:head>
  <title>NextPOS - Analytics Hub</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p class="text-xs uppercase tracking-[0.45em] text-fuchsia-300/80">Intelligence</p>
      <h2 class="mt-2 text-3xl font-bold text-white">Reporting Hub</h2>
      <p class="mt-2 max-w-2xl text-sm text-slate-300">
        Analyze revenue trends, spot your top performing merchandise, and filter historical performance.
      </p>
    </div>

    <!-- Timeline Filters -->
    <div class="flex items-center gap-2 rounded-[1.25rem] bg-slate-950/50 p-1 border border-white/10">
      {#each ['today', 'week', 'month', 'all'] as filterType}
        <button
          class="px-4 py-1.5 text-xs font-semibold capitalize rounded-[1rem] transition-colors {
            activeFilter === filterType 
            ? 'bg-fuchsia-500/20 text-fuchsia-200 shadow-[0_0_0_1px_rgba(217,70,239,0.3)]' 
            : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }"
          on:click={() => setDateFilter(filterType as DateFilter)}
        >
          {filterType === 'all' ? 'All Time' : filterType}
        </button>
      {/each}
    </div>
  </header>

  <!-- KPI Cards -->
  <section class="grid gap-4 md:grid-cols-3">
    <article class="panel-surface p-5 border-t-2 border-t-fuchsia-500/50">
      <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Total Revenue</p>
      <div class="mt-4 break-words">
        <p class="text-4xl font-bold text-white">{formatMMK(revenue)}</p>
        <p class="mt-1 text-sm text-fuchsia-200/80">Myanmar Kyat</p>
      </div>
    </article>

    <article class="panel-surface p-5 border-t-2 border-t-cyan-500/50">
      <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Transactions</p>
      <div class="mt-4">
        <p class="text-4xl font-bold text-white">{count}</p>
        <p class="mt-1 text-sm text-cyan-200/80">Completed invoices</p>
      </div>
    </article>

    <article class="panel-surface p-5 border-t-2 border-t-amber-500/50">
      <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Average Order Value</p>
      <div class="mt-4">
        <p class="text-4xl font-bold text-white">{formatMMK(aov)} <span class="text-base font-normal text-slate-400">Ks</span></p>
        <p class="mt-1 text-sm text-amber-200/80">Per transaction</p>
      </div>
    </article>
  </section>

  <div class="grid gap-6 lg:grid-cols-3 lg:items-start">
    <!-- Trend Chart -->
    <section class="panel-surface lg:col-span-2 p-5 border border-white/5">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-white">7-Day Revenue Trend</h3>
          <p class="text-sm text-slate-400">Gross sales performance over the past week.</p>
        </div>
      </div>
      <div class="h-72 w-full relative">
        <Line data={trendChartData} options={chartOptions} />
      </div>
    </section>

    <!-- Top Products Table -->
    <section class="panel-surface p-5 border border-white/5 h-full lg:h-[24rem] flex flex-col">
      <div class="mb-4 shrink-0">
        <h3 class="text-lg font-bold text-white">Top Movers</h3>
        <p class="text-sm text-slate-400">Best selling items by revenue.</p>
      </div>
      
      <div class="flex-1 overflow-y-auto pr-2 hide-scrollbar">
        {#if topItems.length === 0}
          <div class="flex h-full items-center justify-center text-sm text-slate-500 text-center">
            No item sales found for this period.
          </div>
        {:else}
          <div class="space-y-4">
            {#each topItems as item, idx}
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 border border-white/10 text-xs font-bold text-slate-300">
                  {idx + 1}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-200">{item.name}</p>
                  <p class="text-xs text-slate-400">{item.qty} units sold</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-bold text-fuchsia-300">{formatMMK(item.revenue)}</p>
                  <p class="text-xs text-slate-500">Gross</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  </div>
</div>
