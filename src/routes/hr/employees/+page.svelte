<svelte:options runes={false} />

<script lang="ts">
  import { onMount } from 'svelte';
  import { createHrEmployee, deleteHrEmployee, listHrEmployees, updateHrEmployee } from '$lib/api/hr';
  import { resolveTenantId } from '$lib/api/tenant';
  import { auth } from '$lib/stores/auth.svelte';
  import type { HrEmployee } from '$lib/types/index';
  import { formatMMK } from '$lib/types/index';
  import { fade, slide, scale } from 'svelte/transition';

  let tenantId = '';
  let employees: HrEmployee[] = [];
  let selectedEmployeeId: number | null = null;
  let code = '';
  let name = '';
  let position = '';
  let baseSalary = '0';
  let errorMessage = '';
  let successMessage = '';
  let isLoading = true;
  let isSaving = false;

  onMount(() => {
    tenantId = resolveTenantId(auth.activation.tenantId);
    void loadEmployees();
  });

  async function loadEmployees() {
    if (!tenantId) {
      errorMessage = 'Tenant ID not found. Sign in with an Enterprise license to use HR Payroll.';
      isLoading = false;
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      employees = await listHrEmployees(tenantId);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to load employees.';
    } finally {
      isLoading = false;
    }
  }

  function startCreate() {
    selectedEmployeeId = null;
    code = '';
    name = '';
    position = '';
    baseSalary = '0';
    successMessage = '';
    errorMessage = '';
  }

  function startEdit(employee: HrEmployee) {
    selectedEmployeeId = employee.id;
    code = employee.code;
    name = employee.name;
    position = employee.position;
    baseSalary = String(employee.baseSalary);
    successMessage = '';
    errorMessage = '';
  }

  async function saveEmployee() {
    errorMessage = '';
    successMessage = '';

    if (!code.trim() || !name.trim() || !position.trim()) {
      errorMessage = 'Code, name, and position are required.';
      return;
    }

    isSaving = true;

    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        position: position.trim(),
        baseSalary: Number(baseSalary || 0),
      };

      if (selectedEmployeeId) {
        await updateHrEmployee(tenantId, selectedEmployeeId, payload);
        successMessage = 'Employee updated successfully.';
      } else {
        await createHrEmployee(tenantId, payload);
        successMessage = 'Employee created successfully.';
      }

      startCreate();
      await loadEmployees();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to save employee.';
    } finally {
      isSaving = false;
    }
  }

  async function removeEmployee() {
    if (!selectedEmployeeId) {
      return;
    }

    isSaving = true;
    errorMessage = '';
    successMessage = '';

    try {
      await deleteHrEmployee(tenantId, selectedEmployeeId);
      successMessage = 'Employee deleted successfully.';
      startCreate();
      await loadEmployees();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to delete employee.';
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>HR Directory | KT POS</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 p-6 lg:p-8 space-y-8" in:fade>
  <header class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between pb-6 border-b border-white/5">
    <div>
      <h1 class="text-3xl font-black tracking-tighter text-white uppercase italic">
        Human <span class="text-emerald-500">Resources</span>
      </h1>
      <p class="text-xs font-bold text-white/40 uppercase tracking-[0.3em] mt-1 italic">Enterprise Personnel Directory & Payroll Synthesis</p>
    </div>

    <button
      class="glass-button primary px-8 py-3 text-[10px] font-black italic shadow-[0_0_30px_rgba(34,197,94,0.2)]"
      on:click={startCreate}
      type="button"
    >
      + REGISTER_INITIATIVE
    </button>
  </header>

  <section class="grid gap-8 xl:grid-cols-[400px,1fr]">
    <!-- Form Panel -->
    <article class="glass-panel p-8 border-t-2 border-emerald-500/50 flex flex-col h-fit sticky top-8">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h3 class="text-xs font-black text-white uppercase tracking-[0.2em] italic">Profile Configuration</h3>
          <p class="text-[9px] text-white/30 uppercase font-bold tracking-widest mt-1">Registry Data Management</p>
        </div>
        {#if selectedEmployeeId}
          <span class="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest animate-pulse">
            Active_Edit #{selectedEmployeeId}
          </span>
        {/if}
      </div>

      <div class="space-y-6">
        <div class="space-y-2">
          <span class="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 italic">Designation Code</span>
          <input
            bind:value={code}
            class="w-full bg-zinc-900 border border-white/10 p-3 px-4 text-xs text-white font-bold outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/5 uppercase tracking-widest"
            placeholder="EMP_X_UNIT..."
          />
        </div>

        <div class="space-y-2">
          <span class="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 italic">Legal Entity Name</span>
          <input
            bind:value={name}
            class="w-full bg-zinc-900 border border-white/10 p-3 px-4 text-xs text-white font-bold outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/5 uppercase tracking-widest italic"
            placeholder="INPUT FULL NAME..."
          />
        </div>

        <div class="space-y-2">
          <span class="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 italic">Operational Position</span>
          <input
            bind:value={position}
            class="w-full bg-zinc-900 border border-white/10 p-3 px-4 text-xs text-white/60 outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/5 uppercase tracking-tighter italic"
            placeholder="ROLE ASSIGNMENT..."
          />
        </div>

        <div class="space-y-2">
          <span class="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 italic">Base Asset Compensation (MMK)</span>
          <input
            bind:value={baseSalary}
            class="w-full bg-zinc-900 border border-white/10 p-3 px-4 text-sm text-emerald-400 font-black italic outline-none focus:border-emerald-500/50 transition-all tabular-nums"
            min="0"
            step="0.01"
            type="number"
          />
        </div>
      </div>

      {#if errorMessage}
        <div class="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-300 uppercase tracking-widest italic" in:slide>
          {errorMessage}
        </div>
      {/if}

      {#if successMessage}
        <div class="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-300 uppercase tracking-widest italic" in:slide>
          {successMessage}
        </div>
      {/if}

      <div class="mt-10 flex flex-col gap-3">
        <button
          class="glass-button primary w-full py-4 text-[10px] font-black italic shadow-2xl shadow-emerald-500/10"
          disabled={isSaving}
          on:click={() => void saveEmployee()}
          type="button"
        >
          <span class="tracking-[0.4em]">{isSaving ? 'EXECUTING_SYNC...' : selectedEmployeeId ? 'COMMIT_UPDATES' : 'INITIALIZE_RECORD'}</span>
        </button>

        {#if selectedEmployeeId}
          <button
            class="glass-button secondary w-full py-3 text-[10px] font-black border-rose-500/20 text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/10"
            disabled={isSaving}
            on:click={() => void removeEmployee()}
            type="button"
          >
            DELETE_PROTOCOL
          </button>
        {/if}
      </div>
    </article>

    <!-- List Panel -->
    <article class="glass-panel overflow-hidden border-t-2 border-zinc-800">
      <div class="bg-white/5 px-8 py-5 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 class="text-xs font-black text-white uppercase tracking-[0.4em] italic">Collective Personnel Hub</h3>
          <p class="text-[9px] text-white/20 uppercase font-bold tracking-widest mt-0.5 italic">High-Density Asset Tracking</p>
        </div>
        <div class="flex items-center gap-4">
             <div class="h-10 w-px bg-white/10 hidden sm:block"></div>
             <div class="flex flex-col items-end">
                <span class="text-[9px] font-black text-white/20 uppercase">Total Headcount</span>
                <span class="text-sm font-black text-white italic tabular-nums tracking-tighter">{employees.length}</span>
             </div>
        </div>
      </div>

      {#if isLoading}
        <div class="p-20 flex flex-col items-center justify-center opacity-20">
            <div class="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p class="text-[10px] font-black uppercase tracking-[0.5em] italic">Retaking Registry Feed...</p>
        </div>
      {:else if !employees.length}
        <div class="p-32 flex flex-col items-center justify-center opacity-10">
            <svg class="w-20 h-20 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <p class="text-[10px] font-black uppercase tracking-[0.5em] italic text-center leading-loose">No active personnel detected in current matrix</p>
        </div>
      {:else}
        <div class="overflow-x-auto min-h-[500px] scrollbar-thin">
          <table class="min-w-full text-left text-sm border-separate border-spacing-0">
            <thead class="sticky top-0 bg-zinc-900 z-10">
              <tr class="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 italic">
                <th class="px-8 py-5 border-b border-white/10">Designation</th>
                <th class="px-8 py-5 border-b border-white/10">Entity Name</th>
                <th class="px-8 py-5 border-b border-white/10">Operational Position</th>
                <th class="px-8 py-5 border-b border-white/10 text-right">Compensation_MMK</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              {#each employees as employee (employee.id)}
                <tr
                  class={`group cursor-pointer hover:bg-emerald-500/[0.03] transition-all duration-300 ${
                    selectedEmployeeId === employee.id ? 'bg-emerald-500/10' : ''
                  }`}
                  on:click={() => startEdit(employee)}
                >
                  <td class="px-8 py-5">
                      <div class="flex flex-col">
                          <span class="text-xs font-black text-white italic tracking-widest">{employee.code}</span>
                          <span class="text-[8px] font-bold text-white/10 uppercase tracking-widest">Sys_Node_Ref</span>
                      </div>
                  </td>
                  <td class="px-8 py-5">
                      <span class="text-xs font-bold text-white uppercase italic tracking-tight group-hover:text-emerald-400 transition-colors">{employee.name}</span>
                  </td>
                  <td class="px-8 py-5">
                      <span class="text-[10px] font-bold text-white/40 uppercase tracking-tighter italic">{employee.position}</span>
                  </td>
                  <td class="px-8 py-5 text-right">
                      <div class="flex flex-col items-end">
                          <span class="text-xs font-black text-emerald-500 italic tabular-nums">{formatMMK(employee.baseSalary)}</span>
                          <span class="text-[7px] font-black text-white/10 uppercase italic">Monthly Dispatch</span>
                      </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </article>
  </section>
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
    
    .scrollbar-thin::-webkit-scrollbar {
        width: 4px;
        height: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
    .scrollbar-thin::-webkit-scrollbar-thumb { @apply bg-white/10 rounded-full hover:bg-emerald-500/30; }
</style>

