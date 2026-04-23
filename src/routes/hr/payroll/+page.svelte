<svelte:options runes={false} />

<script lang="ts">
  import { onMount } from 'svelte';
  import {
    createHrPayrollPeriod,
    listHrPayrollPeriods,
    listHrPayslips,
    processHrPayroll,
  } from '$lib/api/hr';
  import { resolveTenantId } from '$lib/api/tenant';
  import { auth } from '$lib/stores/auth.svelte';
  import type { HrPayrollPeriod, HrPayslipAggregate } from '$lib/types/index';
  import { formatMMK } from '$lib/types/index';
  import { printReceipt } from '$lib/platform';

  let tenantId = '';
  let periods: HrPayrollPeriod[] = [];
  let payslips: HrPayslipAggregate[] = [];
  let selectedPeriodId = '';
  let startDate = '';
  let endDate = '';
  let errorMessage = '';
  let successMessage = '';
  let isLoading = true;
  let isCreating = false;
  let isProcessing = false;

  onMount(() => {
    tenantId = resolveTenantId(auth.activation.tenantId);
    void initialize();
  });

  $: selectedPeriod = periods.find((period) => String(period.id) === selectedPeriodId) ?? null;

  async function initialize() {
    if (!tenantId) {
      errorMessage = 'Tenant ID not found. Sign in with an Enterprise license to use HR Payroll.';
      isLoading = false;
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      await loadPeriods();
      if (periods[0]) {
        selectedPeriodId = String(periods[0].id);
        await loadPayslips();
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to load payroll data.';
    } finally {
      isLoading = false;
    }
  }

  async function loadPeriods() {
    periods = await listHrPayrollPeriods(tenantId);
  }

  async function loadPayslips() {
    if (!selectedPeriodId) {
      payslips = [];
      return;
    }

    try {
      payslips = await listHrPayslips(tenantId, Number(selectedPeriodId));
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to load payslips.';
    }
  }

  async function createPeriod() {
    if (!startDate || !endDate) {
      errorMessage = 'Start date and end date are required.';
      return;
    }

    isCreating = true;
    errorMessage = '';
    successMessage = '';

    try {
      const period = await createHrPayrollPeriod(tenantId, { startDate, endDate });
      successMessage = 'Payroll period created successfully.';
      await loadPeriods();
      selectedPeriodId = String(period.id);
      await loadPayslips();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to create payroll period.';
    } finally {
      isCreating = false;
    }
  }

  async function processSelectedPeriod() {
    if (!selectedPeriodId) {
      errorMessage = 'Select a payroll period first.';
      return;
    }

    isProcessing = true;
    errorMessage = '';
    successMessage = '';

    try {
      payslips = await processHrPayroll(tenantId, Number(selectedPeriodId));
      await loadPeriods();
      successMessage = 'Payroll processed successfully.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to process payroll.';
    } finally {
      isProcessing = false;
    }
  }

  async function printPayslip(row: HrPayslipAggregate) {
    if (!selectedPeriod) return;

    const receiptContent = `
================================
         SALARY PAYSLIP         
================================
Employee: ${row.employee.code}
Name    : ${row.employee.name}
Role    : ${row.employee.position}
Period  : ${selectedPeriod.startDate} to ${selectedPeriod.endDate}
--------------------------------
Days Present:  ${row.payslip.daysPresent}
OT Hours    :  ${row.payslip.overtimeHours.toFixed(2)}
--------------------------------
Basic Pay   :  ${formatMMK(row.payslip.basicPay)} Ks
OT Pay      :  ${formatMMK(row.payslip.overtimePay)} Ks
Deductions  : -${formatMMK(row.payslip.deductions)} Ks
--------------------------------
NET SALARY  :  ${formatMMK(row.payslip.netPay)} Ks
================================
    `.trim();

    await printReceipt(receiptContent);
  }
</script>

<svelte:head>
  <title>HR Payroll</title>
</svelte:head>

<div class="space-y-6">
  <header>
    <p class="text-xs uppercase tracking-[0.45em] text-cyan-200/80">Payroll Engine</p>
    <h2 class="mt-2 text-3xl font-bold text-white">Payroll Periods & Payslips</h2>
    <p class="mt-2 max-w-3xl text-sm text-slate-300">
      Net pay formula: `(base_salary / 30) * days_present + overtime_pay - deductions`
    </p>
  </header>

  <section class="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
    <article class="panel-surface p-5">
      <div>
        <h3 class="text-lg font-semibold text-white">Create Payroll Period</h3>
        <p class="text-sm text-slate-400">Overlapping periods are blocked to keep runs deterministic.</p>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Start Date</span>
          <input
            bind:value={startDate}
            class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
            type="date"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-xs uppercase tracking-[0.22em] text-slate-400">End Date</span>
          <input
            bind:value={endDate}
            class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
            type="date"
          />
        </label>
      </div>

      <button
        class="touch-button mt-5 rounded-2xl bg-cyan-300 px-5 text-slate-950 hover:bg-cyan-200"
        disabled={isCreating}
        on:click={() => void createPeriod()}
        type="button"
      >
        {isCreating ? 'Creating...' : 'Create Period'}
      </button>

      <div class="mt-8 border-t border-white/8 pt-5">
        <h3 class="text-lg font-semibold text-white">Process Payroll</h3>
        <p class="mt-1 text-sm text-slate-400">Current UI processes with deductions = 0 by default.</p>

        <label class="mt-4 grid gap-2">
          <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Period</span>
          <select
            bind:value={selectedPeriodId}
            class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
            on:change={() => void loadPayslips()}
          >
            <option value="">Select period</option>
            {#each periods as period}
              <option value={String(period.id)}>
                {period.startDate} -> {period.endDate} ({period.status})
              </option>
            {/each}
          </select>
        </label>

        <button
          class="touch-button mt-5 rounded-2xl bg-orange-400 px-5 text-slate-950 hover:bg-orange-300"
          disabled={isProcessing || !selectedPeriodId}
          on:click={() => void processSelectedPeriod()}
          type="button"
        >
          {isProcessing ? 'Processing...' : 'Process Payslips'}
        </button>
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
    </article>

    <article class="panel-surface overflow-hidden">
      <div class="border-b border-white/8 px-5 py-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-white">Payslip Viewer</h3>
            <p class="text-sm text-slate-400">
              {selectedPeriod
                ? `${selectedPeriod.startDate} -> ${selectedPeriod.endDate}`
                : 'Select a period to inspect processed payslips.'}
            </p>
          </div>
          {#if selectedPeriod}
            <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              {selectedPeriod.status}
            </span>
          {/if}
        </div>
      </div>

      {#if isLoading}
        <div class="p-5 text-sm text-slate-400">Loading payroll...</div>
      {:else if !payslips.length}
        <div class="p-5 text-sm text-slate-400">No payslips yet for the selected period.</div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-white/[0.03] text-xs uppercase tracking-[0.22em] text-slate-400">
              <tr>
                <th class="px-5 py-3">Employee</th>
                <th class="px-5 py-3">Days</th>
                <th class="px-5 py-3">OT Hours</th>
                <th class="px-5 py-3">Basic</th>
                <th class="px-5 py-3">OT Pay</th>
                <th class="px-5 py-3">Net</th>
                <th class="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each payslips as row}
                <tr class="border-t border-white/6 text-slate-200">
                  <td class="px-5 py-4">
                    <p class="font-semibold text-white">{row.employee.name}</p>
                    <p class="mt-1 text-xs text-slate-500">{row.employee.code} - {row.employee.position}</p>
                  </td>
                  <td class="px-5 py-4">{row.payslip.daysPresent}</td>
                  <td class="px-5 py-4">{row.payslip.overtimeHours.toFixed(2)}</td>
                  <td class="px-5 py-4">{formatMMK(row.payslip.basicPay)} MMK</td>
                  <td class="px-5 py-4">{formatMMK(row.payslip.overtimePay)} MMK</td>
                  <td class="px-5 py-4 font-semibold text-cyan-200">{formatMMK(row.payslip.netPay)} MMK</td>
                  <td class="px-5 py-4 text-right">
                    <button
                      class="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-400/20"
                      on:click={() => void printPayslip(row)}
                      type="button"
                    >
                      Print
                    </button>
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
