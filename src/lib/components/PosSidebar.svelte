<svelte:options runes={false} />

<script lang="ts">
  import { page } from '$app/state';
  import { auth } from '$lib/stores/auth.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { sales } from '$lib/stores/sales.svelte';
  import { featureStore } from '$lib/stores/featureStore.js';

  const navItems = [
    { href: '/pos/dashboard', label: 'Dashboard', meta: 'Live pulse' },
    { href: '/pos/reports', label: 'Reports', meta: 'Analytics Hub' },
    { href: '/pos/terminal', label: 'Terminal', meta: 'Checkout lane' },
    { href: '/pos/inventory', label: 'Inventory', meta: 'Stock watch' },
  ];

  const todayKey = new Date().toISOString().slice(0, 10);
  
  $: todayTxCount = sales.all.filter(
    (sale) => sale.saleDate.startsWith(todayKey) && sale.status === 'COMPLETED'
  ).length;

  $: lowStockCount = products.all.filter(
    (product) => product.stock > 0 && product.stock <= product.reorderLevel
  ).length;

</script>

<aside class="flex flex-col border-b border-white/10 bg-slate-950/65 px-5 py-6 backdrop-blur-2xl lg:border-b-0 lg:border-r overflow-y-auto">
  <div class="panel-surface p-5 shrink-0">
    <p class="text-xs uppercase tracking-[0.35em] text-teal-300/80">Retail Core</p>
    <h1 class="mt-3 text-2xl font-bold text-white leading-tight">{auth.companyName}</h1>
  </div>

  <nav class="mt-6 flex flex-col gap-3 shrink-0">
    {#each navItems as item}
      <a
        href={item.href}
        class={`block rounded-[1.4rem] border px-4 py-3 transition ${
          page.url.pathname === item.href
            ? 'border-teal-400/30 bg-teal-400/15 text-white shadow-[0_0_0_1px_rgba(45,212,191,0.18)]'
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
        <span class="mt-1 block text-xs text-slate-400">Payroll visible by feature flag</span>
      </a>
    {/if}
  </nav>

  <div class="panel-muted mt-6 p-4 shrink-0">
    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Today</p>
    <div class="mt-4 grid gap-3 text-sm text-slate-300">
      <div class="flex items-center justify-between">
        <span>Transactions</span>
        <strong class="text-white">{todayTxCount}</strong>
      </div>
      <div class="flex items-center justify-between">
        <span>Low Stock SKUs</span>
        <strong class="text-white">{lowStockCount}</strong>
      </div>
    </div>
  </div>
</aside>
