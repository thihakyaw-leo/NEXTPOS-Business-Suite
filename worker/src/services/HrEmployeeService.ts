import { inject, injectable } from 'inversify';
import {
  TYPES,
  type HrAttendanceClockInput,
  type HrAttendanceClockResult,
  type HrAttendanceRecord,
  type HrEmployeeRecord,
  type ID1Repository,
  type IHrEmployeeService,
  type UpsertHrEmployeeInput,
} from '../interfaces.js';

@injectable()
export class HrEmployeeService implements IHrEmployeeService {
  constructor(@inject(TYPES.ID1Repository) private readonly d1: ID1Repository) {}

  listEmployees(tenantId: string): Promise<HrEmployeeRecord[]> {
    return this.d1.query<HrEmployeeRecord>(
      `SELECT *
       FROM hr_employees
       WHERE tenant_id = ? AND isdeleted = 0
       ORDER BY code ASC, id ASC`,
      [tenantId],
    );
  }

  getEmployeeById(tenantId: string, employeeId: number): Promise<HrEmployeeRecord | null> {
    return this.d1.first<HrEmployeeRecord>(
      `SELECT *
       FROM hr_employees
       WHERE tenant_id = ? AND id = ? AND isdeleted = 0`,
      [tenantId, employeeId],
    );
  }

  async createEmployee(input: UpsertHrEmployeeInput): Promise<HrEmployeeRecord> {
    const normalized = normalizeEmployeeInput(input);
    const existing = await this.d1.first<HrEmployeeRecord>(
      `SELECT *
       FROM hr_employees
       WHERE tenant_id = ? AND code = ? AND isdeleted = 0`,
      [normalized.tenant_id, normalized.code],
    );

    if (existing) {
      throw new HrValidationError(`Employee code ${normalized.code} already exists`, 409);
    }

    const now = new Date().toISOString();

    await this.d1.execute(
      `INSERT INTO hr_employees
       (tenant_id, code, name, position, base_salary, isdeleted, createdate, updatedate)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        normalized.tenant_id,
        normalized.code,
        normalized.name,
        normalized.position,
        normalized.base_salary,
        now,
        now,
      ],
    );

    const employee = await this.d1.first<HrEmployeeRecord>(
      `SELECT *
       FROM hr_employees
       WHERE tenant_id = ? AND code = ? AND isdeleted = 0`,
      [normalized.tenant_id, normalized.code],
    );

    if (!employee) {
      throw new HrValidationError('Employee was created but could not be reloaded', 500);
    }

    return employee;
  }

  async updateEmployee(
    tenantId: string,
    employeeId: number,
    input: UpsertHrEmployeeInput,
  ): Promise<HrEmployeeRecord> {
    const existing = await this.getEmployeeById(tenantId, employeeId);

    if (!existing) {
      throw new HrValidationError('Employee not found', 404);
    }

    const normalized = normalizeEmployeeInput({
      ...input,
      tenant_id: tenantId,
    });
    const duplicate = await this.d1.first<HrEmployeeRecord>(
      `SELECT *
       FROM hr_employees
       WHERE tenant_id = ? AND code = ? AND id != ? AND isdeleted = 0`,
      [tenantId, normalized.code, employeeId],
    );

    if (duplicate) {
      throw new HrValidationError(`Employee code ${normalized.code} already exists`, 409);
    }

    const now = new Date().toISOString();

    await this.d1.execute(
      `UPDATE hr_employees
       SET code = ?, name = ?, position = ?, base_salary = ?, updatedate = ?
       WHERE tenant_id = ? AND id = ? AND isdeleted = 0`,
      [
        normalized.code,
        normalized.name,
        normalized.position,
        normalized.base_salary,
        now,
        tenantId,
        employeeId,
      ],
    );

    const employee = await this.getEmployeeById(tenantId, employeeId);

    if (!employee) {
      throw new HrValidationError('Employee was updated but could not be reloaded', 500);
    }

    return employee;
  }

  async deleteEmployee(tenantId: string, employeeId: number): Promise<void> {
    const existing = await this.getEmployeeById(tenantId, employeeId);

    if (!existing) {
      throw new HrValidationError('Employee not found', 404);
    }

    const now = new Date().toISOString();

    await this.d1.execute(
      `UPDATE hr_employees
       SET isdeleted = 1, updatedate = ?
       WHERE tenant_id = ? AND id = ? AND isdeleted = 0`,
      [now, tenantId, employeeId],
    );
  }

  async clockAttendance(input: HrAttendanceClockInput): Promise<HrAttendanceClockResult> {
    if (!input.tenant_id?.trim()) {
      throw new HrValidationError('tenant_id is required');
    }

    if (!Number.isInteger(input.employee_id) || input.employee_id < 1) {
      throw new HrValidationError('employee_id must be a valid positive integer');
    }

    const employee = await this.getEmployeeById(input.tenant_id, input.employee_id);

    if (!employee) {
      throw new HrValidationError('Employee not found', 404);
    }

    const timestamp = parseTimestamp(input.timestamp);
    const nowIso = timestamp.toISOString();
    const dateKey = nowIso.slice(0, 10);
    const openAttendance = await this.d1.first<HrAttendanceRecord>(
      `SELECT *
       FROM hr_attendance
       WHERE tenant_id = ? AND employee_id = ? AND date = ? AND check_out IS NULL AND isdeleted = 0
       ORDER BY check_in DESC, id DESC
       LIMIT 1`,
      [input.tenant_id, input.employee_id, dateKey],
    );

    if (openAttendance?.id) {
      const checkIn = new Date(openAttendance.check_in);
      const hoursWorked = toHours(timestamp.getTime() - checkIn.getTime());

      if (hoursWorked < 0) {
        throw new HrValidationError('check_out cannot be earlier than check_in');
      }

      await this.d1.execute(
        `UPDATE hr_attendance
         SET check_out = ?, hours_worked = ?, updatedate = ?
         WHERE id = ? AND tenant_id = ?`,
        [nowIso, hoursWorked, nowIso, openAttendance.id, input.tenant_id],
      );

      const attendance = await this.d1.first<HrAttendanceRecord>(
        `SELECT *
         FROM hr_attendance
         WHERE id = ? AND tenant_id = ?`,
        [openAttendance.id, input.tenant_id],
      );

      if (!attendance) {
        throw new HrValidationError('Attendance was updated but could not be reloaded', 500);
      }

      return {
        action: 'CLOCK_OUT',
        attendance,
        employee,
      };
    }

    const todayClosed = await this.d1.first<HrAttendanceRecord>(
      `SELECT *
       FROM hr_attendance
       WHERE tenant_id = ? AND employee_id = ? AND date = ? AND check_out IS NOT NULL AND isdeleted = 0
       ORDER BY check_in DESC, id DESC
       LIMIT 1`,
      [input.tenant_id, input.employee_id, dateKey],
    );

    if (todayClosed) {
      throw new HrValidationError('Employee already clocked out for today', 409);
    }

    await this.d1.execute(
      `INSERT INTO hr_attendance
       (tenant_id, employee_id, check_in, check_out, hours_worked, date, isdeleted, createdate, updatedate)
       VALUES (?, ?, ?, NULL, 0, ?, 0, ?, ?)`,
      [input.tenant_id, input.employee_id, nowIso, dateKey, nowIso, nowIso],
    );

    const attendance = await this.d1.first<HrAttendanceRecord>(
      `SELECT *
       FROM hr_attendance
       WHERE tenant_id = ? AND employee_id = ? AND date = ? AND check_in = ? AND isdeleted = 0`,
      [input.tenant_id, input.employee_id, dateKey, nowIso],
    );

    if (!attendance) {
      throw new HrValidationError('Attendance was created but could not be reloaded', 500);
    }

    return {
      action: 'CLOCK_IN',
      attendance,
      employee,
    };
  }

  listAttendance(tenantId: string, employeeId?: number): Promise<HrAttendanceRecord[]> {
    if (employeeId && employeeId > 0) {
      return this.d1.query<HrAttendanceRecord>(
        `SELECT *
         FROM hr_attendance
         WHERE tenant_id = ? AND employee_id = ? AND isdeleted = 0
         ORDER BY date DESC, check_in DESC, id DESC`,
        [tenantId, employeeId],
      );
    }

    return this.d1.query<HrAttendanceRecord>(
      `SELECT *
       FROM hr_attendance
       WHERE tenant_id = ? AND isdeleted = 0
       ORDER BY date DESC, check_in DESC, id DESC`,
      [tenantId],
    );
  }
}

export class HrValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'HrValidationError';
    this.statusCode = statusCode;
  }
}

function normalizeEmployeeInput(input: UpsertHrEmployeeInput): UpsertHrEmployeeInput {
  const tenantId = input.tenant_id?.trim();
  const code = input.code?.trim().toUpperCase();
  const name = input.name?.trim();
  const position = input.position?.trim();
  const baseSalary = toCurrency(input.base_salary);

  if (!tenantId) {
    throw new HrValidationError('tenant_id is required');
  }

  if (!code) {
    throw new HrValidationError('code is required');
  }

  if (!name) {
    throw new HrValidationError('name is required');
  }

  if (!position) {
    throw new HrValidationError('position is required');
  }

  if (baseSalary < 0) {
    throw new HrValidationError('base_salary must be zero or greater');
  }

  return {
    tenant_id: tenantId,
    code,
    name,
    position,
    base_salary: baseSalary,
  };
}

function parseTimestamp(value?: string): Date {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new HrValidationError('timestamp must be a valid ISO date-time');
  }

  return parsed;
}

function toHours(milliseconds: number): number {
  return Number((milliseconds / (1000 * 60 * 60)).toFixed(2));
}

function toCurrency(value: number | null | undefined): number {
  return Number(Number(value ?? 0).toFixed(2));
}
