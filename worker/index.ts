import 'reflect-metadata';
import { AutoRouter, cors, json, type IRequestStrict } from 'itty-router';
import { createContainer } from './inversify.config.js';
import {
  TYPES,
  type CreateSaleInput,
  type IAuthService,
  type IDeliveryService,
  type IFeatureGuard,
  type IHrEmployeeService,
  type IPayrollProcessor,
  type ISaleService,
  type IInventoryService,
  type UpsertProductInput,
  type RegisterTenantInput,
  type UpsertHrEmployeeInput,
  type ValidateTenantInput,
} from './src/interfaces.js';
import { DeliveryValidationError } from './src/services/DeliveryService.js';
import { HrValidationError } from './src/services/HrEmployeeService.js';
import { InventoryValidationError, SalePersistenceError } from './src/services/SaleService.js';
import type { Env } from './src/types.js';

const { preflight, corsify } = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Device-Fingerprint'],
});

const router = AutoRouter<IRequestStrict, [Env, ExecutionContext]>({
  before: [preflight],
  finally: [corsify],
  catch: (cause) => {
    console.error('Unhandled worker error', cause);

    return json(
      {
        success: false,
        error: cause instanceof Error ? cause.message : 'Internal server error',
      },
      { status: 500 },
    );
  },
});

const getServices = (env: Env) => {
  const container = createContainer(env);

  return {
    authService: container.get<IAuthService>(TYPES.IAuthService),
    deliveryService: container.get<IDeliveryService>(TYPES.IDeliveryService),
    featureGuard: container.get<IFeatureGuard>(TYPES.IFeatureGuard),
    hrEmployeeService: container.get<IHrEmployeeService>(TYPES.IHrEmployeeService),
    payrollProcessor: container.get<IPayrollProcessor>(TYPES.IPayrollProcessor),
    saleService: container.get<ISaleService>(TYPES.ISaleService),
    inventoryService: container.get<IInventoryService>(TYPES.IInventoryService),
  };
};

const getTenantId = (request: Request): string | null =>
  new URL(request.url).searchParams.get('tenant_id') ?? request.headers.get('x-tenant-id');

router.get('/api/health', (_request, env) =>
  json({
    success: true,
    service: 'nextpos-worker',
    environment: env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  }),
);

router.post('/api/auth/register', async (request, env) => {
  const body = await parseJsonBody<RegisterTenantInput>(request);

  if (!body) {
    return json(
      {
        success: false,
        error: 'The request body must be valid JSON',
      },
      { status: 400 },
    );
  }

  if (!body.company_name?.trim() || !body.email?.trim() || !body.device_fingerprint?.trim()) {
    return json(
      {
        success: false,
        error: 'company_name, email, and device_fingerprint are required',
      },
      { status: 400 },
    );
  }

  const { authService } = getServices(env);
  const registration = await authService.registerTenant(body);

  if (!registration) {
    return json(
      {
        success: false,
        error: 'This device is already registered',
      },
      { status: 409 },
    );
  }

  return json(
    {
      success: true,
      data: registration,
    },
    { status: 201 },
  );
});

router.post('/api/auth/validate', async (request, env) => {
  const body = await parseJsonBody<ValidateTenantInput>(request);

  if (!body?.token?.trim() || !body?.device_fingerprint?.trim()) {
    return json(
      {
        success: false,
        error: 'token and device_fingerprint are required',
      },
      { status: 400 },
    );
  }

  const { authService } = getServices(env);
  const result = await authService.validateTenant(body);

  return json({
    success: true,
    ...result,
  });
});

router.post('/api/admin/auth/login', async (request, env) => {
  const body = await parseJsonBody<{ username?: string; password?: string }>(request);

  if (!body?.username?.trim() || !body?.password?.trim()) {
    return json(
      {
        success: false,
        error: 'username and password are required',
      },
      { status: 400 },
    );
  }

  const { authService } = getServices(env);
  const adminSession = await authService.authenticateAdmin(body.username, body.password, request);

  if (!adminSession) {
    return json(
      {
        success: false,
        error: 'Invalid administrator credentials',
      },
      { status: 401 },
    );
  }

  return json(
    {
      success: true,
      data: {
        role: 'admin',
        expires_at: adminSession.expires_at,
      },
    },
    {
      headers: {
        'Set-Cookie': adminSession.cookie,
      },
    },
  );
});

router.get('/api/sales', async (request, env) => {
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return json(
      {
        success: false,
        error: 'tenant_id query parameter or X-Tenant-Id header is required',
      },
      { status: 400 },
    );
  }

  const { featureGuard, saleService } = getServices(env);
  const claims = await featureGuard.getTenantClaims(request, tenantId);

  if (!claims) {
    return unauthorizedResponse();
  }

  const sales = await saleService.getSales(tenantId);

  return json({
    success: true,
    data: sales,
  });
});

router.get('/api/sales/:id', async (request, env) => {
  const tenantId = getTenantId(request);
  const saleId = Number(request.params.id);

  if (!tenantId) {
    return json(
      {
        success: false,
        error: 'tenant_id query parameter or X-Tenant-Id header is required',
      },
      { status: 400 },
    );
  }

  if (!Number.isInteger(saleId) || saleId < 1) {
    return json(
      {
        success: false,
        error: 'A valid numeric sale id is required',
      },
      { status: 400 },
    );
  }

  const { featureGuard, saleService } = getServices(env);
  const claims = await featureGuard.getTenantClaims(request, tenantId);

  if (!claims) {
    return unauthorizedResponse();
  }

  const sale = await saleService.getSaleById(tenantId, saleId);

  if (!sale) {
    return json(
      {
        success: false,
        error: 'Sale not found',
      },
      { status: 404 },
    );
  }

  return json({
    success: true,
    data: sale,
  });
});

const createSaleHandler = async (request: IRequestStrict, env: Env) => {
  const body = await parseJsonBody<CreateSaleInput>(request);

  if (!body?.sale || !Array.isArray(body.details) || body.details.length === 0) {
    return json(
      {
        success: false,
        error: 'The request body must include a sale object and at least one detail row',
      },
      { status: 400 },
    );
  }

  if (!body.sale.tenant_id?.trim()) {
    return json(
      {
        success: false,
        error: 'sale.tenant_id is required',
      },
      { status: 400 },
    );
  }

  const { featureGuard, saleService } = getServices(env);
  const claims = await featureGuard.getTenantClaims(request, body.sale.tenant_id);

  if (!claims || !featureGuard.hasFeature(claims, 'sales.write')) {
    return unauthorizedResponse();
  }

  try {
    const aggregate = await saleService.createSale(body);

    return json(
      {
        success: true,
        data: aggregate,
      },
      { status: 201 },
    );
  } catch (cause) {
    if (cause instanceof InventoryValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    if (cause instanceof SalePersistenceError) {
      return json(
        {
          success: false,
          error: cause.message,
          snapshot_key: cause.snapshotKey,
          recovery_snapshot: cause.recoverySnapshot,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
};

router.post('/api/sale', createSaleHandler);
router.post('/api/sales', createSaleHandler);

router.post('/api/delivery/estimate', async (request, env) => {
  const body = await parseJsonBody<Record<string, unknown>>(request);
  const tenantId =
    typeof body?.tenant_id === 'string' && body.tenant_id.trim()
      ? body.tenant_id.trim()
      : getTenantId(request);

  if (!tenantId) {
    return json(
      {
        success: false,
        error: 'tenant_id is required',
      },
      { status: 400 },
    );
  }

  if (!body?.pickup || !body?.dropoff || !Array.isArray(body?.packages) || body.packages.length === 0) {
    return json(
      {
        success: false,
        error: 'pickup, dropoff, and at least one package are required',
      },
      { status: 400 },
    );
  }

  const { deliveryService, featureGuard } = getServices(env);
  const claims = await featureGuard.getTenantClaims(request, tenantId);

  if (!claims || !featureGuard.hasFeature(claims, 'sales.write')) {
    return unauthorizedResponse();
  }

  try {
    const quotes = await deliveryService.estimate({
      ...body,
      tenant_id: tenantId,
    } as Parameters<IDeliveryService['estimate']>[0]);

    return json({
      success: true,
      data: quotes,
    });
  } catch (cause) {
    if (cause instanceof DeliveryValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
});

router.post('/api/delivery/create', async (request, env) => {
  const body = await parseJsonBody<Record<string, unknown>>(request);
  const tenantId =
    typeof body?.tenant_id === 'string' && body.tenant_id.trim()
      ? body.tenant_id.trim()
      : getTenantId(request);

  if (!tenantId) {
    return json(
      {
        success: false,
        error: 'tenant_id is required',
      },
      { status: 400 },
    );
  }

  if (!body?.provider || !body?.pickup || !body?.dropoff) {
    return json(
      {
        success: false,
        error: 'provider, pickup, and dropoff are required',
      },
      { status: 400 },
    );
  }

  const { deliveryService, featureGuard } = getServices(env);
  const claims = await featureGuard.getTenantClaims(request, tenantId);

  if (!claims || !featureGuard.hasFeature(claims, 'sales.write')) {
    return unauthorizedResponse();
  }

  try {
    const result = await deliveryService.createDelivery({
      ...body,
      tenant_id: tenantId,
    } as Parameters<IDeliveryService['createDelivery']>[0]);

    return json(
      {
        success: true,
        data: result,
      },
      { status: 201 },
    );
  } catch (cause) {
    if (cause instanceof DeliveryValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
});

router.post('/api/webhook/delivery', async (request, env) => {
  const body = await parseJsonBody<Record<string, unknown>>(request);

  if (!body) {
    return json(
      {
        success: false,
        error: 'The request body must be valid JSON',
      },
      { status: 400 },
    );
  }

  const { deliveryService } = getServices(env);

  try {
    const result = await deliveryService.handleWebhook(request, body);

    return json({
      success: true,
      data: result,
    });
  } catch (cause) {
    if (cause instanceof DeliveryValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
});

router.get('/api/hr/employees', async (request, env) => {
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return missingTenantResponse();
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  const employees = await access.hrEmployeeService.listEmployees(tenantId);

  return json({
    success: true,
    data: employees,
  });
});

router.post('/api/hr/employees', async (request, env) => {
  const body = await parseJsonBody<UpsertHrEmployeeInput>(request);
  const tenantId = body?.tenant_id?.trim() || getTenantId(request);

  if (!tenantId) {
    return missingTenantResponse();
  }

  if (!body) {
    return invalidJsonResponse();
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  try {
    const employee = await access.hrEmployeeService.createEmployee({
      ...body,
      tenant_id: tenantId,
    });

    return json(
      {
        success: true,
        data: employee,
      },
      { status: 201 },
    );
  } catch (cause) {
    if (cause instanceof HrValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
});

router.put('/api/hr/employees/:id', async (request, env) => {
  const body = await parseJsonBody<UpsertHrEmployeeInput>(request);
  const employeeId = Number(request.params.id);
  const tenantId = body?.tenant_id?.trim() || getTenantId(request);

  if (!tenantId) {
    return missingTenantResponse();
  }

  if (!body) {
    return invalidJsonResponse();
  }

  if (!Number.isInteger(employeeId) || employeeId < 1) {
    return invalidNumericIdResponse('employee id');
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  try {
    const employee = await access.hrEmployeeService.updateEmployee(tenantId, employeeId, {
      ...body,
      tenant_id: tenantId,
    });

    return json({
      success: true,
      data: employee,
    });
  } catch (cause) {
    if (cause instanceof HrValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
});

router.delete('/api/hr/employees/:id', async (request, env) => {
  const employeeId = Number(request.params.id);
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return missingTenantResponse();
  }

  if (!Number.isInteger(employeeId) || employeeId < 1) {
    return invalidNumericIdResponse('employee id');
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  try {
    await access.hrEmployeeService.deleteEmployee(tenantId, employeeId);

    return json({
      success: true,
    });
  } catch (cause) {
    if (cause instanceof HrValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
});

router.get('/api/hr/attendance', async (request, env) => {
  const tenantId = getTenantId(request);
  const employeeId = Number(new URL(request.url).searchParams.get('employee_id'));

  if (!tenantId) {
    return missingTenantResponse();
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  const attendance = await access.hrEmployeeService.listAttendance(
    tenantId,
    Number.isInteger(employeeId) && employeeId > 0 ? employeeId : undefined,
  );

  return json({
    success: true,
    data: attendance,
  });
});

router.post('/api/hr/attendance/clock', async (request, env) => {
  const body = await parseJsonBody<{ tenant_id?: string; employee_id?: number; timestamp?: string }>(request);
  const tenantId = body?.tenant_id?.trim() || getTenantId(request);

  if (!tenantId) {
    return missingTenantResponse();
  }

  if (!body) {
    return invalidJsonResponse();
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  try {
    const result = await access.hrEmployeeService.clockAttendance({
      tenant_id: tenantId,
      employee_id: Number(body.employee_id),
      timestamp: body.timestamp,
    });

    return json({
      success: true,
      data: result,
    });
  } catch (cause) {
    if (cause instanceof HrValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
});

router.get('/api/hr/payroll/periods', async (request, env) => {
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return missingTenantResponse();
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  const periods = await access.payrollProcessor.listPeriods(tenantId);

  return json({
    success: true,
    data: periods,
  });
});

router.post('/api/hr/payroll/periods', async (request, env) => {
  const body = await parseJsonBody<{ tenant_id?: string; start_date?: string; end_date?: string }>(request);
  const tenantId = body?.tenant_id?.trim() || getTenantId(request);

  if (!tenantId) {
    return missingTenantResponse();
  }

  if (!body) {
    return invalidJsonResponse();
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  try {
    const period = await access.payrollProcessor.createPeriod({
      tenant_id: tenantId,
      start_date: body.start_date ?? '',
      end_date: body.end_date ?? '',
    });

    return json(
      {
        success: true,
        data: period,
      },
      { status: 201 },
    );
  } catch (cause) {
    if (cause instanceof HrValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
});

router.get('/api/hr/payroll/payslips', async (request, env) => {
  const tenantId = getTenantId(request);
  const periodId = Number(new URL(request.url).searchParams.get('period_id'));

  if (!tenantId) {
    return missingTenantResponse();
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  const payslips = await access.payrollProcessor.listPayslips(
    tenantId,
    Number.isInteger(periodId) && periodId > 0 ? periodId : undefined,
  );

  return json({
    success: true,
    data: payslips,
  });
});

router.get('/api/products', async (request, env) => {
  const tenantId = getTenantId(request);
  if (!tenantId) return unauthorizedResponse();

  const { featureGuard, inventoryService } = getServices(env);
  const claims = await featureGuard.getTenantClaims(request, tenantId);
  if (!claims) return unauthorizedResponse();

  const products = await inventoryService.listProducts(tenantId);
  return json({ success: true, data: products });
});

router.post('/api/products', async (request, env) => {
  const body = await parseJsonBody<UpsertProductInput>(request);
  const tenantId = body?.tenant_id?.trim() || getTenantId(request);
  if (!tenantId) return unauthorizedResponse();

  if (!body) return invalidJsonResponse();

  const { featureGuard, inventoryService } = getServices(env);
  const claims = await featureGuard.getTenantClaims(request, tenantId);
  if (!claims || !featureGuard.hasFeature(claims, 'sales.write')) {
    return unauthorizedResponse();
  }

  try {
    const product = await inventoryService.upsertProduct({ ...body, tenant_id: tenantId });
    return json({ success: true, data: product }, { status: 201 });
  } catch (cause) {
    return json({ success: false, error: cause instanceof Error ? cause.message : 'Unknown Error' }, { status: 400 });
  }
});

router.delete('/api/products/:item_code', async (request, env) => {
  const tenantId = getTenantId(request);
  if (!tenantId) return unauthorizedResponse();
  const itemCode = request.params.item_code;

  const { featureGuard, inventoryService } = getServices(env);
  const claims = await featureGuard.getTenantClaims(request, tenantId);
  if (!claims || !featureGuard.hasFeature(claims, 'sales.write')) {
    return unauthorizedResponse();
  }

  await inventoryService.deleteProduct(tenantId, itemCode);
  return json({ success: true });
});

router.post('/api/hr/payroll/process', async (request, env) => {
  const body = await parseJsonBody<{
    tenant_id?: string;
    period_id?: number;
    deductions?: Array<{ employee_id: number; amount: number }>;
  }>(request);
  const tenantId = body?.tenant_id?.trim() || getTenantId(request);

  if (!tenantId) {
    return missingTenantResponse();
  }

  if (!body) {
    return invalidJsonResponse();
  }

  const access = await ensureEnterpriseHrAccess(request, env, tenantId);

  if (access instanceof Response) {
    return access;
  }

  try {
    const payslips = await access.payrollProcessor.processPeriod({
      tenant_id: tenantId,
      period_id: Number(body.period_id),
      deductions: body.deductions,
    });

    return json({
      success: true,
      data: payslips,
    });
  } catch (cause) {
    if (cause instanceof HrValidationError) {
      return json(
        {
          success: false,
          error: cause.message,
        },
        { status: cause.statusCode },
      );
    }

    throw cause;
  }
});

router.all('*', () =>
  json(
    {
      success: false,
      error: 'Not found',
    },
    { status: 404 },
  ),
);

export default {
  fetch(request, env, ctx) {
    return router.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function ensureEnterpriseHrAccess(
  request: Request,
  env: Env,
  tenantId: string,
): Promise<
  | Response
  | {
      hrEmployeeService: IHrEmployeeService;
      payrollProcessor: IPayrollProcessor;
    }
> {
  const services = getServices(env);
  const claims = await services.featureGuard.getTenantClaims(request, tenantId);

  if (!claims) {
    return unauthorizedResponse();
  }

  if (claims.plan_type !== 'enterprise' || !services.featureGuard.hasFeature(claims, 'hr_payroll')) {
    return forbiddenResponse('Enterprise HR Payroll access is required');
  }

  return {
    hrEmployeeService: services.hrEmployeeService,
    payrollProcessor: services.payrollProcessor,
  };
}

function invalidJsonResponse(): Response {
  return json(
    {
      success: false,
      error: 'The request body must be valid JSON',
    },
    { status: 400 },
  );
}

function invalidNumericIdResponse(label: string): Response {
  return json(
    {
      success: false,
      error: `A valid numeric ${label} is required`,
    },
    { status: 400 },
  );
}

function missingTenantResponse(): Response {
  return json(
    {
      success: false,
      error: 'tenant_id query parameter or X-Tenant-Id header is required',
    },
    { status: 400 },
  );
}

function unauthorizedResponse(): Response {
  return json(
    {
      success: false,
      error: 'Unauthorized',
    },
    { status: 401 },
  );
}

function forbiddenResponse(message = 'Forbidden'): Response {
  return json(
    {
      success: false,
      error: message,
    },
    { status: 403 },
  );
}
