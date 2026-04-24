<script lang="ts">
  import { page } from '$app/state';
  import { auth } from '$lib/stores/auth.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { sales } from '$lib/stores/sales.svelte';
  import { formatMMK } from '$lib/types/index';
  import { slide } from 'svelte/transition';
  import UserSwitcher from '$lib/components/UserSwitcher.svelte';
  import { rbac } from '$lib/stores/rbacStore.svelte';

  /** Returns true if the current RBAC user can access this module. */
  function canNav(permission: string): boolean {
    return rbac.can(permission);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  
  let todaySales = $derived(sales.all.filter(
    (sale) => sale.saleDate.startsWith(todayKey) && sale.status === 'COMPLETED',
  ));
  let todayRevenue = $derived(todaySales.reduce((sum, sale) => sum + sale.netAmount, 0));
  let lowStockCount = $derived(products.all.filter(
    (product) => product.stock > 0 && product.stock <= product.reorderLevel,
  ).length);

  // Accordion state
  let openMenus = $state<Record<string, boolean>>({
    ecommerce: page.url.pathname.includes('ecommerce'),
    sale: page.url.pathname.includes('sales') || page.url.pathname.includes('terminal'),
    purchase: page.url.pathname.includes('purchase'),
    service: page.url.pathname.includes('service'),
    stock: page.url.pathname.includes('inventory') || page.url.pathname.includes('adjustment'),
    accounts: page.url.pathname.includes('accounts'),
    report: page.url.pathname.includes('reports') && !page.url.pathname.includes('dashboard'),
    product: page.url.pathname.includes('product'),
    subscription: page.url.pathname.includes('manageapplication'),
  });

  function toggleMenu(menu: string) {
    openMenus[menu] = !openMenus[menu];
  }
</script>

<aside class="pos-sidebar bg-zinc-950 flex flex-col h-full overflow-hidden border-r border-white/5 relative z-50 shadow-[50px_0_100px_-20px_rgba(0,0,0,0.5)]">
  <!-- Immersive Branding -->
  <div class="h-24 flex items-center px-8 bg-white/[0.01] shrink-0 border-b border-white/5 relative overflow-hidden">
    <div class="absolute -top-10 -left-10 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none"></div>
    <div class="w-12 h-12 rounded-sm bg-emerald-500 flex items-center justify-center mr-5 shadow-[0_0_30px_#22c55e33] text-white transform -rotate-6 group transition-all duration-500 hover:rotate-0">
      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    </div>
    <div class="relative">
      <span class="text-white font-black text-2xl italic tracking-tighter block leading-none">KT <span class="text-emerald-500">POS</span></span>
      <span class="text-[9px] font-black text-white/20 uppercase tracking-[0.5em] italic mt-1 block">X_CORE_SYSTEM</span>
    </div>
  </div>

  <!-- Executive Identity (RBAC) -->
  <div class="px-4 py-4 bg-white/[0.01] shrink-0 border-b border-white/5 relative">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-sm bg-zinc-800 border border-white/5 text-white flex items-center justify-center font-black shadow-xl relative overflow-hidden shrink-0">
        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent"></div>
        <span class="text-emerald-500 text-sm italic">{auth.username?.slice(0, 2).toUpperCase() || '??'}</span>
        <div class="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-zinc-900 shadow-[0_0_6px_#22c55e]"></div>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-black text-white uppercase italic tracking-widest truncate leading-tight">{auth.companyName || 'KT POS'}</p>
        <p class="text-[7px] text-white/20 font-black uppercase tracking-[0.3em] truncate italic mt-0.5">GLOBAL_MATRIX_HUB</p>
      </div>
    </div>
    
    <!-- User Switcher -->
    <div class="relative mt-3">
      <UserSwitcher />
    </div>
  </div>

  <nav class="flex-1 overflow-y-auto scrollbar-hide px-5 py-8 space-y-2 thin-scrollbar">
    <!-- DASHBOARD -->
    <a href="/pos/dashboard" class="sidebar-link {page.url.pathname === '/pos/dashboard' ? 'is-active' : ''} {!canNav('dashboard') ? 'locked' : ''}">
      <span class="sidebar-link__icon">BASE_01</span>
      <span class="sidebar-link__title">Command_Center</span>
      {#if !canNav('dashboard')}<span class="ml-auto text-[8px] opacity-30">🔒</span>{/if}
    </a>

    <div class="h-4"></div>
    <p class="px-3 text-[8px] font-black text-white/10 uppercase tracking-[0.6em] mb-4 italic">Operational_Nodes</p>

    <!-- SALE -->
    <div class="sidebar-group {!canNav('sales') ? 'locked' : ''}">
      <button onclick={() => toggleMenu('sale')} class="sidebar-link w-full {page.url.pathname.includes('sales') || page.url.pathname.includes('terminal') ? 'is-active' : ''}">
         <span class="sidebar-link__icon">NODE_S</span>
         <span class="sidebar-link__title">Sales_Intelligence</span>
         {#if !canNav('sales')}
           <span class="ml-auto text-[8px] opacity-30">🔒</span>
         {:else}
           <span class="ml-auto text-[8px] opacity-20 transition-transform {openMenus.sale ? 'rotate-180' : ''}">▼</span>
         {/if}
      </button>
      {#if openMenus.sale}
        <div class="sidebar-sub" transition:slide>
          <a href="/pos/terminal" class="sidebar-sublink">Initialize_POS</a>
          <a href="/pos/sales/manage" class="sidebar-sublink">Audit_Ledger</a>
          <a href="/pos/terminal" class="sidebar-sublink">Draft_Matrix</a>
          <a href="/pos/terminal" class="sidebar-sublink">Returns_Protocol</a>
        </div>
      {/if}
    </div>

    <!-- PURCHASE -->
    <div class="sidebar-group {!canNav('purchase') ? 'locked' : ''}">
      <button onclick={() => toggleMenu('purchase')} class="sidebar-link w-full {page.url.pathname.includes('purchase') ? 'is-active' : ''}">
         <span class="sidebar-link__icon">NODE_P</span>
         <span class="sidebar-link__title">Procurement_Hub</span>
         {#if !canNav('purchase')}
           <span class="ml-auto text-[8px] opacity-30">🔒</span>
         {:else}
           <span class="ml-auto text-[8px] opacity-20 transition-transform {openMenus.purchase ? 'rotate-180' : ''}">▼</span>
         {/if}
      </button>
      {#if openMenus.purchase}
        <div class="sidebar-sub" transition:slide>
          <a href="/pos/purchase" class="sidebar-sublink">Manage_Purchase</a>
          <a href="/pos/people" class="sidebar-sublink">Vendor_Registry</a>
          <a href="/pos/purchase" class="sidebar-sublink">Inventory_Sink</a>
        </div>
      {/if}
    </div>

    <!-- STOCK MANAGEMENT -->
    <div class="sidebar-group">
      <button onclick={() => toggleMenu('stock')} class="sidebar-link w-full {page.url.pathname.includes('inventory') || page.url.pathname.includes('adjustment') ? 'is-active' : ''}">
         <span class="sidebar-link__icon">NODE_I</span>
         <span class="sidebar-link__title">Inventory_Matrix</span>
         <span class="ml-auto text-[8px] opacity-20 transition-transform {openMenus.stock ? 'rotate-180' : ''}">▼</span>
      </button>
      {#if openMenus.stock}
        <div class="sidebar-sub" transition:slide>
          <a href="/pos/inventory" class="sidebar-sublink">Asset_Registry</a>
          <a href="/pos/inventory" class="sidebar-sublink">Stock_Adjustment</a>
          <a href="/pos/inventory" class="sidebar-sublink">Ledger_Extract</a>
        </div>
      {/if}
    </div>

    <!-- WAREHOUSE -->
    <a href="/pos/warehouse" class="sidebar-link {page.url.pathname.includes('warehouse') ? 'is-active' : ''}">
      <span class="sidebar-link__icon">NODE_W</span>
      <span class="sidebar-link__title">Warehousing_Ops</span>
    </a>

    <!-- DELIVERY -->
    <a href="/pos/delivery/setup" class="sidebar-link {page.url.pathname.includes('delivery') ? 'is-active' : ''}">
      <span class="sidebar-link__icon">NODE_L</span>
      <span class="sidebar-link__title">Logistics_Network</span>
    </a>

    <div class="h-8"></div>
    <p class="px-3 text-[8px] font-black text-white/10 uppercase tracking-[0.6em] mb-4 italic">Enterprise_Core</p>

    <!-- ACCOUNTS -->
    <div class="sidebar-group">
      <button onclick={() => toggleMenu('accounts')} class="sidebar-link w-full {page.url.pathname.includes('accounts') ? 'is-active' : ''}">
         <span class="sidebar-link__icon">SYS_F</span>
         <span class="sidebar-link__title">Financial_Engine</span>
         <span class="ml-auto text-[8px] opacity-20 transition-transform {openMenus.accounts ? 'rotate-180' : ''}">▼</span>
      </button>
      {#if openMenus.accounts}
        <div class="sidebar-sub" transition:slide>
          <a href="/pos/accounts" class="sidebar-sublink">Chart_Of_Accounts</a>
          <a href="/pos/accounts" class="sidebar-sublink">Voucher_Matrix</a>
          <a href="/pos/accounts" class="sidebar-sublink">Fiscal_Closure</a>
        </div>
      {/if}
    </div>

    <!-- RELATIONSHIPS -->
    <a href="/pos/people" class="sidebar-link {page.url.pathname.includes('people') ? 'is-active' : ''}">
      <span class="sidebar-link__icon">SYS_R</span>
      <span class="sidebar-link__title">Relationship_Nexus</span>
    </a>

    <!-- PEOPLE LIST -->
    <a href="/hr/employees" class="sidebar-link {page.url.pathname.includes('hr') ? 'is-active' : ''}">
      <span class="sidebar-link__icon">SYS_H</span>
      <span class="sidebar-link__title">Personnel_Sync</span>
    </a>

    <!-- REPORT -->
    <div class="sidebar-group">
      <button onclick={() => toggleMenu('report')} class="sidebar-link w-full {page.url.pathname.includes('reports') && !page.url.pathname.includes('dashboard') ? 'is-active' : ''}">
         <span class="sidebar-link__icon">SYS_A</span>
         <span class="sidebar-link__title">Analytics_Hub</span>
         <span class="ml-auto text-[8px] opacity-20 transition-transform {openMenus.report ? 'rotate-180' : ''}">▼</span>
      </button>
      {#if openMenus.report}
        <div class="sidebar-sub" transition:slide>
          <a href="/pos/reports" class="sidebar-sublink">Volume_Heatmap</a>
          <a href="/pos/reports" class="sidebar-sublink">Revenue_Audit</a>
        </div>
      {/if}
    </div>

    <!-- SETTINGS -->
    <a href="/pos/settings" class="sidebar-link {page.url.pathname.includes('settings') ? 'is-active' : ''}">
      <span class="sidebar-link__icon">SYS_S</span>
      <span class="sidebar-link__title">Control_Settings</span>
    </a>
  </nav>

  <!-- Real-time Performance Telemetry -->
  <div class="px-8 py-10 bg-white/[0.01] border-t border-white/5 shrink-0 relative overflow-hidden">
    <div class="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none"></div>
    
    <div class="flex items-center justify-between mb-4">
        <span class="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] italic leading-none">Net_Daily_Throughput</span>
        <span class="text-[11px] font-black text-emerald-500 tabular-nums italic">{formatMMK(todayRevenue)}</span>
    </div>
    <div class="w-full h-[3px] bg-white/[0.05] rounded-full overflow-hidden mb-6">
        <div class="h-full bg-emerald-500 shadow-[0_0_10px_#22c55e]" style="width: 65%"></div>
    </div>
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
           <span class="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
           <span class="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] italic">Stock_Pressure</span>
        </div>
        <span class="text-[10px] font-black text-rose-500 italic tabular-nums">{lowStockCount} ALERT(S)</span>
    </div>
  </div>
</aside>

<style lang="postcss">
    @reference "tailwindcss";
  .sidebar-link {
    @apply flex items-center gap-4 px-4 py-3.5 text-white/40 no-underline text-[11px] font-black uppercase italic tracking-widest transition-all duration-300 rounded-sm border border-transparent text-left w-full;
  }

  .sidebar-link:hover {
    @apply bg-white/[0.03] text-white border-white/5;
  }

  .sidebar-link.is-active {
    @apply bg-emerald-500 text-white shadow-[0_15px_30px_-5px_#22c55e44] border-emerald-400;
  }

  .sidebar-link__icon {
    @apply text-[9px] w-12 h-6 flex items-center justify-center bg-white/5 rounded-sm group-hover:bg-white/10 transition-colors border border-white/5 font-black italic;
  }

  /* Locked state for RBAC-restricted nav items */
  .locked {
    @apply opacity-35 pointer-events-none select-none;
  }

  .locked .sidebar-link {
    @apply cursor-not-allowed;
  }

  .is-active .sidebar-link__icon {
      @apply bg-white/20 border-white/20;
  }

  .sidebar-sub {
    @apply mt-2 ml-10 border-l border-white/5 flex flex-col gap-1;
  }

  .sidebar-sublink {
    @apply block px-6 py-2.5 text-white/20 no-underline text-[9px] font-black uppercase italic tracking-widest transition-all duration-300 rounded-sm hover:text-emerald-400 hover:bg-white/[0.02];
  }

  .sidebar-sublink::before {
    content: '>>';
    @apply mr-3 opacity-20 text-[8px] font-black;
  }

  .thin-scrollbar::-webkit-scrollbar {
    width: 2px;
  }

  .thin-scrollbar::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .thin-scrollbar::-webkit-scrollbar-thumb {
    @apply bg-white/5 rounded-full;
  }

  .scrollbar-hide::-webkit-scrollbar { display: none; }
</style>
