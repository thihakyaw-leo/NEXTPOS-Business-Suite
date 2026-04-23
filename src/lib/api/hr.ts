import {
  type HrAttendance,
  type HrEmployee,
  type HrPayrollPeriod,
  type HrPayrollPeriodStatus,
  type HrPayslipAggregate,
} from '$lib/types/index';
import { tenantApiFetch } from './tenant';

type RawEmployee = {
  id: number;
  tenant_id: string;
  code: string;
  name: string;
  position: string;
  base_salary: number;
};

type RawAttendance = {
  id: number;
  tenant_id: string;
  employee_id: number;
  check_in: string;
  check_out?: string | null;
  hours_worked: number;
  date: string;
};

type RawPeriod = {
  id: number;
  tenant_id: string;
  start_date: string;
  end_date: string;
  status: HrPayrollPeriodStatus;
  processed_at?: string | null;
};

type RawPayslip = {
  id: number;
  tenant_id: string;
  period_id: number;
  employee_id: number;
  basic_pay: number;
  overtime_pay: number;
  deductions: number;
  net_pay: number;
  days_present: number;
  total_hours: number;
  overtime_hours: number;
};

type RawPayslipAggregate = {
  employee: RawEmployee;
  payslip: RawPayslip;
  period: RawPeriod;
};

type RawClockResult = {
  action: 'CLOCK_IN' | 'CLOCK_OUT';
  attendance: RawAttendance;
  employee: RawEmployee;
};

export function listHrEmployees(tenantId: string): Promise<HrEmployee[]> {
  return tenantApiFetch<RawEmployee[]>('/api/hr/employees', { tenantId }).then((data) =>
    data.map(mapEmployee),
  );
}

export function createHrEmployee(
  tenantId: string,
  payload: { code: string; name: string; position: string; baseSalary: number },
): Promise<HrEmployee> {
  return tenantApiFetch<RawEmployee>('/api/hr/employees', {
    tenantId,
    method: 'POST',
    body: {
      tenant_id: tenantId,
      code: payload.code,
      name: payload.name,
      position: payload.position,
      base_salary: payload.baseSalary,
    },
  }).then(mapEmployee);
}

export function updateHrEmployee(
  tenantId: string,
  employeeId: number,
  payload: { code: string; name: string; position: string; baseSalary: number },
): Promise<HrEmployee> {
  return tenantApiFetch<RawEmployee>(`/api/hr/employees/${employeeId}`, {
    tenantId,
    method: 'PUT',
    body: {
      tenant_id: tenantId,
      code: payload.code,
      name: payload.name,
      position: payload.position,
      base_salary: payload.baseSalary,
    },
  }).then(mapEmployee);
}

export function deleteHrEmployee(tenantId: string, employeeId: number): Promise<void> {
  return tenantApiFetch<undefined>(`/api/hr/employees/${employeeId}`, {
    tenantId,
    method: 'DELETE',
  }).then(() => undefined);
}

export function listHrAttendance(tenantId: string, employeeId?: number): Promise<HrAttendance[]> {
  const query = employeeId ? `?employee_id=${employeeId}` : '';
  return tenantApiFetch<RawAttendance[]>(`/api/hr/attendance${query}`, { tenantId }).then((data) =>
    data.map(mapAttendance),
  );
}

export function clockHrAttendance(
  tenantId: string,
  employeeId: number,
): Promise<{ action: 'CLOCK_IN' | 'CLOCK_OUT'; attendance: HrAttendance; employee: HrEmployee }> {
  return tenantApiFetch<RawClockResult>('/api/hr/attendance/clock', {
    tenantId,
    method: 'POST',
    body: {
      tenant_id: tenantId,
      employee_id: employeeId,
    },
  }).then((data) => ({
    action: data.action,
    attendance: mapAttendance(data.attendance),
    employee: mapEmployee(data.employee),
  }));
}

export function listHrPayrollPeriods(tenantId: string): Promise<HrPayrollPeriod[]> {
  return tenantApiFetch<RawPeriod[]>('/api/hr/payroll/periods', { tenantId }).then((data) =>
    data.map(mapPeriod),
  );
}

export function createHrPayrollPeriod(
  tenantId: string,
  payload: { startDate: string; endDate: string },
): Promise<HrPayrollPeriod> {
  return tenantApiFetch<RawPeriod>('/api/hr/payroll/periods', {
    tenantId,
    method: 'POST',
    body: {
      tenant_id: tenantId,
      start_date: payload.startDate,
      end_date: payload.endDate,
    },
  }).then(mapPeriod);
}

export function listHrPayslips(
  tenantId: string,
  periodId?: number,
): Promise<HrPayslipAggregate[]> {
  const query = periodId ? `?period_id=${periodId}` : '';
  return tenantApiFetch<RawPayslipAggregate[]>(`/api/hr/payroll/payslips${query}`, { tenantId }).then(
    (data) => data.map(mapPayslipAggregate),
  );
}

export function processHrPayroll(
  tenantId: string,
  periodId: number,
): Promise<HrPayslipAggregate[]> {
  return tenantApiFetch<RawPayslipAggregate[]>('/api/hr/payroll/process', {
    tenantId,
    method: 'POST',
    body: {
      tenant_id: tenantId,
      period_id: periodId,
    },
  }).then((data) => data.map(mapPayslipAggregate));
}

function mapEmployee(value: RawEmployee): HrEmployee {
  return {
    id: value.id,
    tenantId: value.tenant_id,
    code: value.code,
    name: value.name,
    position: value.position,
    baseSalary: value.base_salary,
  };
}

function mapAttendance(value: RawAttendance): HrAttendance {
  return {
    id: value.id,
    tenantId: value.tenant_id,
    employeeId: value.employee_id,
    checkIn: value.check_in,
    checkOut: value.check_out ?? null,
    hoursWorked: value.hours_worked,
    date: value.date,
  };
}

function mapPeriod(value: RawPeriod): HrPayrollPeriod {
  return {
    id: value.id,
    tenantId: value.tenant_id,
    startDate: value.start_date,
    endDate: value.end_date,
    status: value.status,
    processedAt: value.processed_at ?? null,
  };
}

function mapPayslipAggregate(value: RawPayslipAggregate): HrPayslipAggregate {
  return {
    employee: mapEmployee(value.employee),
    payslip: {
      id: value.payslip.id,
      tenantId: value.payslip.tenant_id,
      periodId: value.payslip.period_id,
      employeeId: value.payslip.employee_id,
      basicPay: value.payslip.basic_pay,
      overtimePay: value.payslip.overtime_pay,
      deductions: value.payslip.deductions,
      netPay: value.payslip.net_pay,
      daysPresent: value.payslip.days_present,
      totalHours: value.payslip.total_hours,
      overtimeHours: value.payslip.overtime_hours,
    },
    period: mapPeriod(value.period),
  };
}
