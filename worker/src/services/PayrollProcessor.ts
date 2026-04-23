import { inject, injectable } from 'inversify';
import {
  TYPES,
  type CreateHrPayrollPeriodInput,
  type HrAttendanceRecord,
  type HrEmployeeRecord,
  type HrPayrollPeriodRecord,
  type HrPayrollPeriodStatus,
  type HrPayslipAggregate,
  type HrPayslipRecord,
  type ID1Repository,
  type IPayrollProcessor,
  type ProcessHrPayrollInput,
} from '../interfaces.js';
import { HrValidationError } from './HrEmployeeService.js';

@injectable()
export class PayrollProcessor implements IPayrollProcessor {
  constructor(@inject(TYPES.ID1Repository) private readonly d1: ID1Repository) {}

  listPeriods(tenantId: string): Promise<HrPayrollPeriodRecord[]> {
    return this.d1.query<HrPayrollPeriodRecord>(
      `SELECT *
       FROM hr_payroll_periods
       WHERE tenant_id = ? AND isdeleted = 0
       ORDER BY start_date DESC, end_date DESC, id DESC`,
      [tenantId],
    );
  }

  async createPeriod(input: CreateHrPayrollPeriodInput): Promise<HrPayrollPeriodRecord> {
    const normalized = normalizePeriodInput(input);
    const overlap = await this.d1.first<HrPayrollPeriodRecord>(
      `SELECT *
       FROM hr_payroll_periods
       WHERE tenant_id = ?
         AND isdeleted = 0
         AND start_date <= ?
         AND end_date >= ?`,
      [normalized.tenant_id, normalized.end_date, normalized.start_date],
    );

    if (overlap) {
      throw new HrValidationError('Payroll period overlaps an existing period', 409);
    }

    const now = new Date().toISOString();

    await this.d1.execute(
      `INSERT INTO hr_payroll_periods
       (tenant_id, start_date, end_date, status, processed_at, isdeleted, createdate, updatedate)
       VALUES (?, ?, ?, 'DRAFT', NULL, 0, ?, ?)`,
      [normalized.tenant_id, normalized.start_date, normalized.end_date, now, now],
    );

    const period = await this.d1.first<HrPayrollPeriodRecord>(
      `SELECT *
       FROM hr_payroll_periods
       WHERE tenant_id = ? AND start_date = ? AND end_date = ? AND isdeleted = 0`,
      [normalized.tenant_id, normalized.start_date, normalized.end_date],
    );

    if (!period) {
      throw new HrValidationError('Payroll period was created but could not be reloaded', 500);
    }

    return period;
  }

  async processPeriod(input: ProcessHrPayrollInput): Promise<HrPayslipAggregate[]> {
    if (!input.tenant_id?.trim()) {
      throw new HrValidationError('tenant_id is required');
    }

    if (!Number.isInteger(input.period_id) || input.period_id < 1) {
      throw new HrValidationError('period_id must be a valid positive integer');
    }

    const period = await this.d1.first<HrPayrollPeriodRecord>(
      `SELECT *
       FROM hr_payroll_periods
       WHERE tenant_id = ? AND id = ? AND isdeleted = 0`,
      [input.tenant_id, input.period_id],
    );

    if (!period) {
      throw new HrValidationError('Payroll period not found', 404);
    }

    const employees = await this.d1.query<HrEmployeeRecord>(
      `SELECT *
       FROM hr_employees
       WHERE tenant_id = ? AND isdeleted = 0
       ORDER BY code ASC, id ASC`,
      [input.tenant_id],
    );
    const attendance = await this.d1.query<HrAttendanceRecord>(
      `SELECT *
       FROM hr_attendance
       WHERE tenant_id = ?
         AND date >= ?
         AND date <= ?
         AND check_out IS NOT NULL
         AND isdeleted = 0
       ORDER BY date ASC, check_in ASC, id ASC`,
      [input.tenant_id, period.start_date, period.end_date],
    );
    const deductions = new Map<number, number>();

    for (const entry of input.deductions ?? []) {
      if (Number.isInteger(entry.employee_id) && entry.employee_id > 0) {
        deductions.set(entry.employee_id, toCurrency(entry.amount));
      }
    }

    const attendanceByEmployee = new Map<number, HrAttendanceRecord[]>();

    for (const record of attendance) {
      const bucket = attendanceByEmployee.get(record.employee_id) ?? [];
      bucket.push(record);
      attendanceByEmployee.set(record.employee_id, bucket);
    }

    const now = new Date().toISOString();

    await this.updatePeriodStatus(input.tenant_id, input.period_id, 'PROCESSING', null, now);
    await this.d1.execute(
      `UPDATE hr_payslips
       SET isdeleted = 1, updatedate = ?
       WHERE tenant_id = ? AND period_id = ? AND isdeleted = 0`,
      [now, input.tenant_id, input.period_id],
    );

    for (const employee of employees) {
      if (!employee.id) {
        continue;
      }

      const employeeAttendance = attendanceByEmployee.get(employee.id) ?? [];
      const attendanceSummary = summarizeAttendanceByDate(employeeAttendance);
      const totalHours = attendanceSummary.totalHours;
      const overtimeHours = attendanceSummary.overtimeHours;
      const daysPresent = attendanceSummary.daysPresent;
      const dailyRate = employee.base_salary / 30;
      const hourlyRate = dailyRate / 8;
      const basicPay = toCurrency(dailyRate * daysPresent);
      // Overtime is paid at 1.5x the derived hourly rate for hours beyond 8 in a day.
      const overtimePay = toCurrency(overtimeHours * hourlyRate * 1.5);
      const deductionAmount = toCurrency(deductions.get(employee.id) ?? 0);
      const netPay = toCurrency(basicPay + overtimePay - deductionAmount);

      await this.d1.execute(
        `INSERT INTO hr_payslips
         (tenant_id, period_id, employee_id, basic_pay, overtime_pay, deductions,
          net_pay, days_present, total_hours, overtime_hours, isdeleted, createdate, updatedate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          input.tenant_id,
          input.period_id,
          employee.id,
          basicPay,
          overtimePay,
          deductionAmount,
          netPay,
          daysPresent,
          totalHours,
          overtimeHours,
          now,
          now,
        ],
      );
    }

    await this.updatePeriodStatus(input.tenant_id, input.period_id, 'PROCESSED', now, now);

    return this.listPayslips(input.tenant_id, input.period_id);
  }

  async listPayslips(tenantId: string, periodId?: number): Promise<HrPayslipAggregate[]> {
    const params: unknown[] = [tenantId];
    let sql = `
      SELECT
        p.id AS payslip_id,
        p.tenant_id AS payslip_tenant_id,
        p.period_id AS payslip_period_id,
        p.employee_id AS payslip_employee_id,
        p.basic_pay AS payslip_basic_pay,
        p.overtime_pay AS payslip_overtime_pay,
        p.deductions AS payslip_deductions,
        p.net_pay AS payslip_net_pay,
        p.days_present AS payslip_days_present,
        p.total_hours AS payslip_total_hours,
        p.overtime_hours AS payslip_overtime_hours,
        p.createdate AS payslip_createdate,
        p.updatedate AS payslip_updatedate,
        e.id AS employee_id,
        e.tenant_id AS employee_tenant_id,
        e.code AS employee_code,
        e.name AS employee_name,
        e.position AS employee_position,
        e.base_salary AS employee_base_salary,
        pr.id AS period_id,
        pr.tenant_id AS period_tenant_id,
        pr.start_date AS period_start_date,
        pr.end_date AS period_end_date,
        pr.status AS period_status,
        pr.processed_at AS period_processed_at
      FROM hr_payslips p
      INNER JOIN hr_employees e
        ON e.id = p.employee_id AND e.tenant_id = p.tenant_id
      INNER JOIN hr_payroll_periods pr
        ON pr.id = p.period_id AND pr.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
        AND p.isdeleted = 0
        AND e.isdeleted = 0
        AND pr.isdeleted = 0
    `;

    if (periodId && periodId > 0) {
      sql += ' AND p.period_id = ?';
      params.push(periodId);
    }

    sql += ' ORDER BY pr.start_date DESC, e.code ASC, e.id ASC';

    const rows = await this.d1.query<JoinedPayslipRow>(sql, params);

    return rows.map((row) => ({
      employee: {
        id: row.employee_id,
        tenant_id: row.employee_tenant_id,
        code: row.employee_code,
        name: row.employee_name,
        position: row.employee_position,
        base_salary: row.employee_base_salary,
      },
      payslip: {
        id: row.payslip_id,
        tenant_id: row.payslip_tenant_id,
        period_id: row.payslip_period_id,
        employee_id: row.payslip_employee_id,
        basic_pay: row.payslip_basic_pay,
        overtime_pay: row.payslip_overtime_pay,
        deductions: row.payslip_deductions,
        net_pay: row.payslip_net_pay,
        days_present: row.payslip_days_present,
        total_hours: row.payslip_total_hours,
        overtime_hours: row.payslip_overtime_hours,
        createdate: row.payslip_createdate,
        updatedate: row.payslip_updatedate,
      },
      period: {
        id: row.period_id,
        tenant_id: row.period_tenant_id,
        start_date: row.period_start_date,
        end_date: row.period_end_date,
        status: row.period_status,
        processed_at: row.period_processed_at,
      },
    }));
  }

  private updatePeriodStatus(
    tenantId: string,
    periodId: number,
    status: HrPayrollPeriodStatus,
    processedAt: string | null,
    updatedAt: string,
  ): Promise<D1ExecResult> {
    return this.d1.execute(
      `UPDATE hr_payroll_periods
       SET status = ?, processed_at = ?, updatedate = ?
       WHERE tenant_id = ? AND id = ? AND isdeleted = 0`,
      [status, processedAt, updatedAt, tenantId, periodId],
    );
  }
}

type JoinedPayslipRow = {
  payslip_id: number;
  payslip_tenant_id: string;
  payslip_period_id: number;
  payslip_employee_id: number;
  payslip_basic_pay: number;
  payslip_overtime_pay: number;
  payslip_deductions: number;
  payslip_net_pay: number;
  payslip_days_present: number;
  payslip_total_hours: number;
  payslip_overtime_hours: number;
  payslip_createdate?: string;
  payslip_updatedate?: string;
  employee_id: number;
  employee_tenant_id: string;
  employee_code: string;
  employee_name: string;
  employee_position: string;
  employee_base_salary: number;
  period_id: number;
  period_tenant_id: string;
  period_start_date: string;
  period_end_date: string;
  period_status: HrPayrollPeriodStatus;
  period_processed_at?: string | null;
};

function normalizePeriodInput(input: CreateHrPayrollPeriodInput): CreateHrPayrollPeriodInput {
  const tenantId = input.tenant_id?.trim();
  const startDate = normalizeDate(input.start_date);
  const endDate = normalizeDate(input.end_date);

  if (!tenantId) {
    throw new HrValidationError('tenant_id is required');
  }

  if (startDate > endDate) {
    throw new HrValidationError('start_date must be on or before end_date');
  }

  return {
    tenant_id: tenantId,
    start_date: startDate,
    end_date: endDate,
  };
}

function normalizeDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HrValidationError('Dates must use YYYY-MM-DD format');
  }

  return value;
}

function toCurrency(value: number | null | undefined): number {
  return Number(Number(value ?? 0).toFixed(2));
}

function toHours(value: number): number {
  return Number(value.toFixed(2));
}

function summarizeAttendanceByDate(records: HrAttendanceRecord[]): {
  daysPresent: number;
  totalHours: number;
  overtimeHours: number;
} {
  const hoursByDate = new Map<string, number>();

  for (const record of records) {
    hoursByDate.set(record.date, (hoursByDate.get(record.date) ?? 0) + record.hours_worked);
  }

  let totalHours = 0;
  let overtimeHours = 0;

  for (const dailyHours of hoursByDate.values()) {
    totalHours += dailyHours;
    overtimeHours += Math.max(0, dailyHours - 8);
  }

  return {
    daysPresent: hoursByDate.size,
    totalHours: toHours(totalHours),
    overtimeHours: toHours(overtimeHours),
  };
}
