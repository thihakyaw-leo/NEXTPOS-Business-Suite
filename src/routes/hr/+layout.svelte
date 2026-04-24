<svelte:options runes={false} />

<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import { featureStore } from '$lib/stores/featureStore.js';

  let { children } = $props();

  const navItems = [
    { href: '/hr/employees', label: 'Employees', meta: 'Team roster and salary setup' },
    { href: '/hr/attendance', label: 'Attendance', meta: 'Large clock in / out surface' },
    { href: '/hr/payroll', label: 'Payroll', meta: 'Periods and payslip processing' },
  ];
</script>

<div class="min-h-screen ink-grid">
  <div class="grid min-h-screen lg:grid-cols-[18rem,1fr]">
    <aside class="border-b border-white/10 bg-slate-950/65 px-5 py-6 backdrop-blur-xl lg:border-b-0 lg:border-r">
      <div class="panel-surface p-5">
        <p class="text-xs uppercase tracking-[0.35em] text-cyan-200/80">Enterprise HR</p>
        <h1 class="mt-3 text-2xl font-bold text-white">{auth.companyName}</h1>
        <p class="mt-2 text-sm text-slate-300">Employee records, attendance capture, and monthly payroll processing.</p>
      </div>

      <nav class="mt-6 space-y-3">
        {#each navItems as item}
          <a
            href={item.href}
            class="block rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-slate-300 transition hover:border-white/15 hover:bg-white/[0.06]"
          >
            <span class="block text-sm font-semibold">{item.label}</span>
            <span class="mt-1 block text-xs text-slate-400">{item.meta}</span>
          </a>
        {/each}
      </nav>

      <div class="panel-muted mt-6 p-4">
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Feature Flag</p>
        <div class="mt-4 text-sm text-slate-300">
          <div class="flex items-center justify-between">
            <span>HR Payroll</span>
            <strong class="text-white">{$featureStore.includes('hr_payroll') ? 'Enabled' : 'Disabled'}</strong>
          </div>
          <p class="mt-3 text-xs text-slate-500">
            Worker endpoints still require an Enterprise tenant token even when the UI flag is visible.
          </p>
        </div>
      </div>

      <a
        href="/pos/dashboard"
        class="touch-button mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]"
      >
        Back To POS
      </a>
    </aside>

    <main class="overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div class="mx-auto max-w-7xl">
        {@render children()}
      </div>
    </main>
  </div>
</div>
