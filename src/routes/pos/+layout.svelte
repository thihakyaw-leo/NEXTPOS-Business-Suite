<script lang="ts">
  import { page } from '$app/state';
  import PosSidebar from '$lib/components/PosSidebar.svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import UserSwitcher from '$lib/components/UserSwitcher.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { roleStore } from '$lib/stores/featureStore.js';
  import { rbac, ROLE_META, type UserRole } from '$lib/stores/rbacStore.svelte';
  import { fade, scale } from 'svelte/transition';

  let { children } = $props();
  let sidebarOpen = $state(false);

  // ── Route Permission Map ───────────────────────────────────────────────────
  // Maps URL path segments → required permission key from ROLE_PERMISSIONS
  const routePermissions: Record<string, string> = {
    '/pos/dashboard':  'dashboard',
    '/pos/terminal':   'terminal',
    '/pos/sales':      'sales',
    '/pos/purchase':   'purchase',
    '/pos/inventory':  'inventory',
    '/pos/warehouse':  'warehouse',
    '/pos/delivery':   'delivery',
    '/pos/accounts':   'accounts',
    '/pos/reports':    'reports',
    '/pos/people':     'people',
    '/pos/settings':   'settings',
    '/pos/ecommerce':  'ecommerce',
  };

  // Derive the required permission for the current path
  let requiredPermission = $derived(
    Object.entries(routePermissions).find(([route]) =>
      page.url.pathname.startsWith(route)
    )?.[1] ?? null
  );

  // Is access allowed?
  let accessDenied = $derived(
    requiredPermission !== null && !rbac.can(requiredPermission)
  );

  const sectionMeta: Record<string, { eyebrow: string; title: string; copy: string }> = {
    '/pos/dashboard': {
      eyebrow: 'Retail Command',
      title: 'Business dashboard',
      copy: 'Track daily sales, checkout volume, and stock pressure from one polished control surface.',
    },
    '/pos/inventory': {
      eyebrow: 'Catalog Studio',
      title: 'Inventory workspace',
      copy: 'Search, curate, and restock your catalog with faster controls and clearer product density.',
    },
    '/pos/reports': {
      eyebrow: 'Analytics',
      title: 'Reporting hub',
      copy: 'Read trend lines, top movers, and sales health in a calmer, decision-friendly layout.',
    },
    '/pos/terminal': {
      eyebrow: 'Checkout',
      title: 'Retail terminal',
      copy: 'Touch-first billing, barcode capture, and sync review stay available in the fast lane.',
    },
  };

  const todayLabel = new Intl.DateTimeFormat('en-MM', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const currentMeta = $derived(
    sectionMeta[page.url.pathname] ?? {
      eyebrow: 'Workspace',
      title: 'KT POS',
      copy: 'Operate the suite from a single workspace.',
    },
  );

  $effect(() => {
    page.url.pathname;
    sidebarOpen = false;
  });
</script>

{#if page.url.pathname === '/pos/terminal'}
  {@render children()}
{:else}
  <div class="app-shell">
    <div class="pos-shell">
      <div class={`pos-shell__sidebar-wrap ${sidebarOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          class="pos-shell__overlay"
          aria-label="Close navigation"
          onclick={() => (sidebarOpen = false)}
        ></button>

        <div class="pos-shell__sidebar">
          <PosSidebar />
        </div>
      </div>

      <div class="pos-shell__main">
        <header class="shell-topbar panel-surface">
          <div class="pos-shell__heading">
            <button
              type="button"
              class="action-button action-button--ghost pos-shell__menu"
              aria-label="Open navigation"
              onclick={() => (sidebarOpen = true)}
            >
              Menu
            </button>

            <div>
              <p class="section-kicker">{currentMeta.eyebrow}</p>
              <h2 class="pos-shell__title">{currentMeta.title}</h2>
              <p class="pos-shell__summary">{currentMeta.copy}</p>
            </div>
          </div>

          <div class="pos-shell__tools">
            <span class="pill">{todayLabel}</span>
            <span class="pill">{$roleStore}</span>
            <span class="pill pill--accent">{auth.companyName}</span>
            <ThemeSwitcher />
          </div>
        </header>

        <main class="pos-shell__content">
          {#if accessDenied}
            <!-- ── Access Denied Overlay (Operator Access) ──────────────────────────────── -->
            <div
              class="fixed inset-0 z-[1000] bg-[#070a0f]/95 backdrop-blur-2xl flex items-center justify-center p-6 overflow-hidden md:p-10"
              in:fade={{ duration: 400 }}
            >
              <!-- Background glows -->
              <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>
              <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none"></div>

              <div
                class="relative max-w-xl w-full bg-[#111823]/80 border border-white/5 border-t-4 border-t-emerald-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-500"
              >
                <!-- Header -->
                <div class="bg-black/40 border-b border-white/5 px-8 py-3 flex justify-between items-center">
                    <div class="text-[9px] font-black tracking-[0.3em] text-white/20 uppercase">
                        Operator Access Required
                    </div>
                    <button 
                       onclick={() => { auth.markUnauthenticated(); location.reload(); }}
                       class="text-[8px] font-black text-rose-500/50 hover:text-rose-400 uppercase tracking-widest transition-colors flex items-center gap-1.5"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                       Re-activate Machine
                    </button>
                </div>

                <div class="p-10 md:p-14 text-center">
                   <div class="w-16 h-16 mx-auto mb-8 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                   </div>

                   <h2 class="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">
                     Station <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">Restricted</span>
                   </h2>

                   <p class="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] italic leading-relaxed mb-10 max-w-sm mx-auto">
                     Your current session requires an authorized operator. 
                     Please authenticate to continue using this module.
                   </p>

                   <!-- Operator Display -->
                   <div class="space-y-6">
                      {#if rbac.currentUser}
                        {@const meta = ROLE_META[rbac.currentUser.role]}
                        <div class="p-6 bg-white/[0.03] border border-white/5 rounded-xl text-left flex items-center justify-between">
                          <div class="flex items-center gap-4">
                            <span class="text-4xl filter drop-shadow-lg">{rbac.currentUser.avatar}</span>
                            <div>
                              <p class="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mb-1 italic">Active Operator</p>
                              <p class="text-sm font-black text-white uppercase italic">{rbac.currentUser.name}</p>
                              <p class="text-[9px] font-black {meta.color} uppercase tracking-[0.4em] mt-0.5">{meta.label}</p>
                            </div>
                          </div>
                          <div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        </div>
                      {:else}
                        <div class="p-6 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                          <p class="text-[10px] font-black text-rose-400 uppercase tracking-widest italic">No operator is currently authenticated.</p>
                        </div>
                      {/if}

                      <!-- Actions -->
                      <div class="space-y-4 pt-4">
                        <button
                          type="button"
                          onclick={() => history.back()}
                          class="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-white hover:bg-white/5 transition-all border border-white/5 hover:border-white/10 rounded-xl flex items-center justify-center gap-3"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                          Return to Previous
                        </button>
                      </div>
                   </div>
                </div>

                <div class="bg-black/40 p-4 text-center border-t border-white/5">
                   <p class="text-[8px] font-bold text-white/10 uppercase tracking-[0.4em]">KT POS Secure Gateway v5.0.1 // Node Status: Online</p>
                </div>
              </div>
            </div>
          {:else}
            {@render children()}
          {/if}
        </main>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
    @reference "tailwindcss";
  .pos-shell {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }

  .pos-shell__sidebar-wrap {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: none;
  }

  .pos-shell__sidebar-wrap.is-open {
    display: block;
  }

  .pos-shell__overlay {
    position: absolute;
    inset: 0;
    background: rgba(7, 10, 17, 0.42);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .pos-shell__sidebar {
    position: relative;
    z-index: 1;
    width: min(92vw, 22rem);
    height: calc(100vh - 2rem);
    margin: 1rem;
  }

  .pos-shell__main {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .pos-shell__heading {
    display: flex;
    align-items: flex-start;
    gap: 0.8rem;
  }

  .pos-shell__menu {
    display: inline-flex;
    min-width: 4.5rem;
  }

  .pos-shell__title {
    margin-top: 0.3rem;
    font-size: 1.3rem;
    font-weight: 800;
    letter-spacing: -0.05em;
  }

  .pos-shell__summary {
    margin-top: 0.3rem;
    color: var(--text-secondary);
    max-width: 42rem;
    line-height: 1.6;
  }

  .pos-shell__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.65rem;
  }

  .pos-shell__content {
    min-width: 0;
  }

  @media (min-width: 1100px) {
    .pos-shell {
      grid-template-columns: 21.5rem minmax(0, 1fr);
      align-items: start;
    }

    .pos-shell__sidebar-wrap {
      position: static;
      display: block;
    }

    .pos-shell__overlay {
      display: none;
    }

    .pos-shell__sidebar {
      position: sticky;
      top: 1rem;
      width: auto;
      height: calc(100vh - 2rem);
      margin: 0;
    }

    .pos-shell__menu {
      display: none;
    }
  }
</style>
