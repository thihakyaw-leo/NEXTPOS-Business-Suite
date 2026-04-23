<svelte:options runes={false} />

<script lang="ts">
  import { onMount } from 'svelte';
  import { createHrEmployee, deleteHrEmployee, listHrEmployees, updateHrEmployee } from '$lib/api/hr';
  import { resolveTenantId } from '$lib/api/tenant';
  import { auth } from '$lib/stores/auth.svelte';
  import type { HrEmployee } from '$lib/types/index';
  import { formatMMK } from '$lib/types/index';

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
  <title>HR Employees</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p class="text-xs uppercase tracking-[0.45em] text-cyan-200/80">HR Directory</p>
      <h2 class="mt-2 text-3xl font-bold text-white">Employee CRUD</h2>
      <p class="mt-2 max-w-2xl text-sm text-slate-300">
        Code, position, and base salary setup for payroll processing.
      </p>
    </div>

    <button
      class="touch-button rounded-2xl bg-cyan-300 px-5 text-slate-950 hover:bg-cyan-200"
      on:click={startCreate}
      type="button"
    >
      New Employee
    </button>
  </header>

  <section class="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
    <article class="panel-surface p-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-white">Employee Form</h3>
          <p class="text-sm text-slate-400">Create or edit enterprise HR records.</p>
        </div>
        {#if selectedEmployeeId}
          <span class="rounded-full bg-orange-400/12 px-3 py-1 text-xs font-semibold text-orange-100">
            Editing #{selectedEmployeeId}
          </span>
        {/if}
      </div>

      <div class="mt-5 grid gap-4">
        <label class="grid gap-2">
          <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Employee Code</span>
          <input
            bind:value={code}
            class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
            placeholder="EMP-001"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Employee Name</span>
          <input
            bind:value={name}
            class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
            placeholder="Aung Aung"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Position</span>
          <input
            bind:value={position}
            class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
            placeholder="Supervisor"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Base Salary</span>
          <input
            bind:value={baseSalary}
            class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
            min="0"
            step="0.01"
            type="number"
          />
        </label>
      </div>

      {#if errorMessage}
        <div class="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {errorMessage}
        </div>
      {/if}

      {#if successMessage}
        <div class="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </div>
      {/if}

      <div class="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          class="touch-button rounded-2xl bg-cyan-300 px-5 text-slate-950 hover:bg-cyan-200"
          disabled={isSaving}
          on:click={() => void saveEmployee()}
          type="button"
        >
          {isSaving ? 'Saving...' : selectedEmployeeId ? 'Update Employee' : 'Create Employee'}
        </button>

        {#if selectedEmployeeId}
          <button
            class="touch-button rounded-2xl border border-rose-400/20 bg-rose-500/10 px-5 text-rose-100 hover:bg-rose-500/20"
            disabled={isSaving}
            on:click={() => void removeEmployee()}
            type="button"
          >
            Delete
          </button>
        {/if}
      </div>
    </article>

    <article class="panel-surface overflow-hidden">
      <div class="border-b border-white/8 px-5 py-4">
        <h3 class="text-lg font-semibold text-white">Employee List</h3>
        <p class="text-sm text-slate-400">Tap a row to edit salary and position.</p>
      </div>

      {#if isLoading}
        <div class="p-5 text-sm text-slate-400">Loading employees...</div>
      {:else if !employees.length}
        <div class="p-5 text-sm text-slate-400">No employees yet.</div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-white/[0.03] text-xs uppercase tracking-[0.22em] text-slate-400">
              <tr>
                <th class="px-5 py-3">Code</th>
                <th class="px-5 py-3">Name</th>
                <th class="px-5 py-3">Position</th>
                <th class="px-5 py-3">Base Salary</th>
              </tr>
            </thead>
            <tbody>
              {#each employees as employee}
                <tr
                  class={`cursor-pointer border-t border-white/6 text-slate-200 ${
                    selectedEmployeeId === employee.id ? 'bg-cyan-300/8' : ''
                  }`}
                  on:click={() => startEdit(employee)}
                >
                  <td class="px-5 py-4 font-semibold text-white">{employee.code}</td>
                  <td class="px-5 py-4">{employee.name}</td>
                  <td class="px-5 py-4">{employee.position}</td>
                  <td class="px-5 py-4 text-cyan-200">{formatMMK(employee.baseSalary)} MMK</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </article>
  </section>
</div>
