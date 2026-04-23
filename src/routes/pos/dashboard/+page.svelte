<svelte:options runes={false} />

<script lang="ts">
  import { Bar } from 'svelte-chartjs';
  import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Tooltip,
    type ChartOptions,
  } from 'chart.js';
  import { products } from '$lib/stores/products.svelte';
  import { sales } from '$lib/stores/sales.svelte';
  import { featureStore, roleStore } from '$lib/stores/featureStore.js';
  import { formatMMK } from '$lib/types/index';

  ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

  const todayKey = new Date().toISOString().slice(0, 10);
  const topSellingSeed: Record<string, number> = {
    'BEV-001': 42,
    'SNK-001': 31,
    'FOD-001': 28,
    'BEV-002': 24,
    'SNK-002': 19,
    'HOM-001': 13,
    'PER-001': 11,
    'STA-001': 8,
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#cbd5e1',
          font: {
            family: 'Space Grotesk',
          },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#94a3b8',
          precision: 0,
        },
        grid: {
          color: 'rgba(148,163,184,0.12)',
        },
      },
    },
  };

  $: todayTransactions = sales.all.filter(
    (sale) => sale.saleDate.startsWith(todayKey) && sale.status === 'COMPLETED',
  );
  $: todayRevenue = todayTransactions.reduce((sum, sale) => sum + sale.netAmount, 0);
  $: cashSales = todayTransactions.filter((sale) => sale.paymentMethod === 'CASH');
  $: cashDrawerBalance = cashSales.reduce((sum, sale) => sum + sale.netAmount, 0) + 85000;
  $: averageTicket = todayTransactions.length
    ? Math.round(todayRevenue / todayTransactions.length)
    : 0;
  $: recentTransactions = sales.recent(6);
  $: lowStockItems = [...products.all]
    .filter((product) => product.stock <= product.reorderLevel)
    .sort((left, right) => left.stock - right.stock);
  $: topSellingItems = [...products.all]
    .map((product) => ({
      label: product.name,
      units: topSellingSeed[product.itemCode] ?? Math.max(product.reorderLevel + 4, 6),
    }))
    .sort((left, right) => right.units - left.units)
    .slice(0, 5);
  $: topSellingData = {
    labels: topSellingItems.map((item) => item.label),
    datasets: [
      {
        label: 'Units Sold',
        data: topSellingItems.map((item) => item.units),
        borderRadius: 16,
        borderSkipped: false,
        backgroundColor: [
          '#14b8a6',
          '#f97316',
          '#38bdf8',
          '#facc15',
          '#fb7185',
        ],
      },
    ],
  };

  function toneForStock(stock: number, reorderLevel: number): string {
    if (stock <= Math.max(2, reorderLevel / 2)) {
      return 'text-rose-300 bg-rose-500/15 border-rose-400/25';
    }

    return 'text-amber-200 bg-amber-500/15 border-amber-400/25';
  }
</script>

<svelte:head>
  <title>NextPOS Dashboard</title>
</svelte:head>

<div class="px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
  <div class="mx-auto max-w-7xl space-y-6">
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.45em] text-orange-200/80">Dashboard</p>
            <h2 class="mt-2 text-3xl font-bold text-white">POS command view</h2>
            <p class="mt-2 max-w-2xl text-sm text-slate-300">
              Watch checkout velocity, cash position, and shelf pressure from one owner-facing surface.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <a
              href="/pos/terminal"
              class="touch-button rounded-2xl bg-teal-400 px-5 text-slate-950 shadow-[0_20px_40px_-22px_rgba(45,212,191,0.9)] hover:bg-teal-300"
            >
              Open Terminal
            </a>
            <button class="touch-button rounded-2xl border border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.09]">
              Export Shift Snapshot
            </button>
          </div>
        </header>

        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article class="panel-surface p-5">
            <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Today's Sales Summary</p>
            <div class="mt-5 flex items-end justify-between">
              <div>
                <p class="text-3xl font-bold text-white">{formatMMK(todayRevenue)} MMK</p>
                <p class="mt-2 text-sm text-slate-400">{todayTransactions.length} completed transactions</p>
              </div>
              <div class="rounded-2xl bg-teal-400/15 px-3 py-2 text-xs font-semibold text-teal-200">
                Avg {formatMMK(averageTicket)}
              </div>
            </div>
          </article>

          {#if $roleStore === 'owner'}
            <article class="panel-surface p-5">
              <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Cash Drawer Balance</p>
              <div class="mt-5">
                <p class="text-3xl font-bold text-white">{formatMMK(cashDrawerBalance)} MMK</p>
                <p class="mt-2 text-sm text-slate-400">Base float 85,000 MMK plus today's cash takings.</p>
              </div>
            </article>
          {/if}

          <article class="panel-surface p-5">
            <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Credit Exposure</p>
            <div class="mt-5">
              <p class="text-3xl font-bold text-white">
                {formatMMK(
                  todayTransactions
                    .filter((sale) => sale.paymentMethod === 'CREDIT')
                    .reduce((sum, sale) => sum + sale.netAmount, 0),
                )} MMK
              </p>
              <p class="mt-2 text-sm text-slate-400">Uncollected same-day customer balance.</p>
            </div>
          </article>

          <article class="panel-surface p-5">
            <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Low Stock Alerts</p>
            <div class="mt-5">
              <p class="text-3xl font-bold text-white">{lowStockItems.length}</p>
              <p class="mt-2 text-sm text-slate-400">Items at or below reorder line right now.</p>
            </div>
          </article>
        </section>

        <section class="grid gap-6 xl:grid-cols-[1.4fr,0.95fr]">
          <article class="panel-surface overflow-hidden">
            <div class="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <h3 class="text-lg font-semibold text-white">Recent Transactions</h3>
                <p class="text-sm text-slate-400">Latest movement across payment methods.</p>
              </div>
              <span class="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                Live feed
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="min-w-full text-left text-sm">
                <thead class="bg-white/[0.03] text-xs uppercase tracking-[0.22em] text-slate-400">
                  <tr>
                    <th class="px-5 py-3">Invoice</th>
                    <th class="px-5 py-3">Customer</th>
                    <th class="px-5 py-3">Payment</th>
                    <th class="px-5 py-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {#each recentTransactions as sale}
                    <tr class="border-t border-white/6 text-slate-200">
                      <td class="px-5 py-4 font-semibold text-white">{sale.saleNumber}</td>
                      <td class="px-5 py-4">{sale.customerName}</td>
                      <td class="px-5 py-4">
                        <span class="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td class="px-5 py-4 font-semibold text-teal-200">{formatMMK(sale.netAmount)} MMK</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </article>

          <article class="panel-surface p-5">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold text-white">Top 5 Selling Items</h3>
                <p class="text-sm text-slate-400">Fast movers from the current shift sample.</p>
              </div>
              <span class="rounded-full bg-orange-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-orange-200">
                Chart
              </span>
            </div>

            <div class="mt-5 h-80">
              <Bar data={topSellingData} options={chartOptions} />
            </div>
          </article>
        </section>

        <section class="panel-surface p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-lg font-semibold text-white">Low Stock Alert List</h3>
              <p class="text-sm text-slate-400">Replenish these SKUs before the evening rush.</p>
            </div>
            <a
              href="/pos/terminal"
              class="touch-button inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]"
            >
              Quick Sell Check
            </a>
          </div>

          <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {#each lowStockItems as product}
              <article class="panel-muted p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-white">{product.name}</p>
                    <p class="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{product.itemCode}</p>
                  </div>
                  <span class={`rounded-full border px-3 py-1 text-[11px] font-semibold ${toneForStock(product.stock, product.reorderLevel)}`}>
                    {product.stock} left
                  </span>
                </div>
                <div class="mt-4 flex items-center justify-between text-sm text-slate-400">
                  <span>Reorder line</span>
                  <strong class="text-white">{product.reorderLevel}</strong>
                </div>
              </article>
            {/each}
          </div>
        </section>
  </div>
</div>
