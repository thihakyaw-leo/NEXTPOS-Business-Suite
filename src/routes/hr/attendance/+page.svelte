<svelte:options runes={false} />

<script lang="ts">
  import { onMount } from 'svelte';
  import { clockHrAttendance, listHrAttendance, listHrEmployees } from '$lib/api/hr';
  import { resolveTenantId } from '$lib/api/tenant';
  import { auth } from '$lib/stores/auth.svelte';
  import type { HrAttendance, HrEmployee } from '$lib/types/index';

  let tenantId = '';
  let employees: HrEmployee[] = [];
  let attendance: HrAttendance[] = [];
  let selectedEmployeeId = '';
  let errorMessage = '';
  let successMessage = '';
  let isLoading = true;
  let isClocking = false;

  onMount(() => {
    tenantId = resolveTenantId(auth.activation.tenantId);
    void initialize();
  });

  $: selectedEmployee = employees.find((employee) => String(employee.id) === selectedEmployeeId) ?? null;
  $: latestAttendance = attendance[0] ?? null;
  $: clockActionLabel = latestAttendance && !latestAttendance.checkOut ? 'Clock Out' : 'Clock In';

  async function initialize() {
    if (!tenantId) {
      errorMessage = 'Tenant ID not found. Sign in with an Enterprise license to use HR Payroll.';
      isLoading = false;
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      employees = await listHrEmployees(tenantId);
      selectedEmployeeId = employees[0] ? String(employees[0].id) : '';
      await loadAttendance();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to load attendance data.';
    } finally {
      isLoading = false;
    }
  }

  async function loadAttendance() {
    if (!selectedEmployeeId) {
      attendance = [];
      return;
    }

    try {
      attendance = await listHrAttendance(tenantId, Number(selectedEmployeeId));
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to load attendance history.';
    }
  }

  async function handleClock() {
    if (!selectedEmployeeId) {
      errorMessage = 'Select an employee first.';
      return;
    }

    isClocking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const result = await clockHrAttendance(tenantId, Number(selectedEmployeeId));
      successMessage =
        result.action === 'CLOCK_IN'
          ? `${result.employee.name} clocked in successfully.`
          : `${result.employee.name} clocked out successfully.`;
      await loadAttendance();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to record attendance.';
    } finally {
      isClocking = false;
    }
  }
</script>

<svelte:head>
  <title>HR Attendance</title>
</svelte:head>

<div class="space-y-6">
  <header>
    <p class="text-xs uppercase tracking-[0.45em] text-cyan-200/80">Attendance Console</p>
    <h2 class="mt-2 text-3xl font-bold text-white">Clock In / Clock Out</h2>
    <p class="mt-2 max-w-2xl text-sm text-slate-300">
      One-tap attendance capture for enterprise payroll.
    </p>
  </header>

  <section class="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
    <article class="panel-surface p-6">
      <label class="grid gap-2">
        <span class="text-xs uppercase tracking-[0.22em] text-slate-400">Employee</span>
        <select
          bind:value={selectedEmployeeId}
          class="touch-button rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100"
          on:change={() => void loadAttendance()}
        >
          <option value="">Select employee</option>
          {#each employees as employee}
            <option value={String(employee.id)}>{employee.code} - {employee.name}</option>
          {/each}
        </select>
      </label>

      <div class="mt-6 rounded-[1.8rem] border border-white/8 bg-white/[0.04] p-5 text-center">
        <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Current Action</p>
        <p class="mt-3 text-2xl font-bold text-white">
          {selectedEmployee ? selectedEmployee.name : 'No employee selected'}
        </p>
        <p class="mt-2 text-sm text-slate-400">
          {latestAttendance && !latestAttendance.checkOut
            ? `Checked in at ${new Date(latestAttendance.checkIn).toLocaleTimeString('en-MM')}`
            : 'Ready for next shift'}
        </p>

        <button
          class={`mt-6 inline-flex min-h-40 w-full items-center justify-center rounded-[2rem] text-3xl font-bold shadow-[0_28px_60px_-32px_rgba(34,211,238,0.9)] ${
            latestAttendance && !latestAttendance.checkOut
              ? 'bg-orange-400 text-slate-950 hover:bg-orange-300'
              : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
          }`}
          disabled={!selectedEmployeeId || isClocking}
          on:click={() => void handleClock()}
          type="button"
        >
          {isClocking ? 'Working...' : clockActionLabel}
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
        <h3 class="text-lg font-semibold text-white">Attendance History</h3>
        <p class="text-sm text-slate-400">Latest attendance rows for the selected employee.</p>
      </div>

      {#if isLoading}
        <div class="p-5 text-sm text-slate-400">Loading attendance...</div>
      {:else if !attendance.length}
        <div class="p-5 text-sm text-slate-400">No attendance rows yet.</div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-white/[0.03] text-xs uppercase tracking-[0.22em] text-slate-400">
              <tr>
                <th class="px-5 py-3">Date</th>
                <th class="px-5 py-3">Check In</th>
                <th class="px-5 py-3">Check Out</th>
                <th class="px-5 py-3">Hours</th>
              </tr>
            </thead>
            <tbody>
              {#each attendance as row}
                <tr class="border-t border-white/6 text-slate-200">
                  <td class="px-5 py-4 font-semibold text-white">{row.date}</td>
                  <td class="px-5 py-4">{new Date(row.checkIn).toLocaleTimeString('en-MM')}</td>
                  <td class="px-5 py-4">
                    {row.checkOut ? new Date(row.checkOut).toLocaleTimeString('en-MM') : 'Open shift'}
                  </td>
                  <td class="px-5 py-4 text-cyan-200">{row.hoursWorked.toFixed(2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </article>
  </section>
</div>
