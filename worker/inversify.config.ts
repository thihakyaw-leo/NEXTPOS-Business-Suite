import 'reflect-metadata';
import { Container } from 'inversify';
import {
  TYPES,
  type IAuthService,
  type ICostingService,
  type ICustomerReceivableRepository,
  type ID1Repository,
  type IDeliveryProvider,
  type IDeliveryProviderFactory,
  type IDeliveryService,
  type IHrEmployeeService,
  type IFeatureGuard,
  type IInventoryLedgerRepository,
  type IInventoryService,
  type IPayrollProcessor,
  type IR2Repository,
  type ISaleService,
} from './src/interfaces.js';
import { DeliveryProviderFactory } from './src/providers/DeliveryProviderFactory.js';
import { GrabProvider } from './src/providers/GrabProvider.js';
import { MockProvider } from './src/providers/MockProvider.js';
import { CustomerReceivableRepository } from './src/repositories/CustomerReceivableRepository.js';
import { D1Repository } from './src/repositories/d1.repository.js';
import { InventoryLedgerRepository } from './src/repositories/InventoryLedgerRepository.js';
import { R2Repository } from './src/repositories/r2.repository.js';
import { AuthService } from './src/services/AuthService.js';
import { CostingService } from './src/services/CostingService.js';
import { InventoryService } from './src/services/InventoryService.js';
import { DeliveryService } from './src/services/DeliveryService.js';
import { FeatureGuard } from './src/services/FeatureGuard.js';
import { HrEmployeeService } from './src/services/HrEmployeeService.js';
import { PayrollProcessor } from './src/services/PayrollProcessor.js';
import { SaleService } from './src/services/SaleService.js';
import type { Env } from './src/types.js';

export function createContainer(env: Env): Container {
  const container = new Container();

  container.bind<Env>(TYPES.Env).toConstantValue(env);
  container.bind<D1Database>(TYPES.D1Database).toConstantValue(env.DB);
  container.bind<R2Bucket>(TYPES.R2Bucket).toConstantValue(env.R2_BUCKET);

  container.bind<ID1Repository>(TYPES.ID1Repository).to(D1Repository);
  container.bind<IR2Repository>(TYPES.IR2Repository).to(R2Repository);
  container.bind<IInventoryLedgerRepository>(TYPES.IInventoryLedgerRepository).to(InventoryLedgerRepository);
  container
    .bind<ICustomerReceivableRepository>(TYPES.ICustomerReceivableRepository)
    .to(CustomerReceivableRepository);
  container.bind<ICostingService>(TYPES.ICostingService).to(CostingService);
  container.bind<ISaleService>(TYPES.ISaleService).to(SaleService);
  container.bind<IDeliveryProvider>(TYPES.MockDeliveryProvider).to(MockProvider);
  container.bind<IDeliveryProvider>(TYPES.GrabDeliveryProvider).to(GrabProvider);
  container.bind<IDeliveryProviderFactory>(TYPES.IDeliveryProviderFactory).to(DeliveryProviderFactory);
  container.bind<IDeliveryService>(TYPES.IDeliveryService).to(DeliveryService);
  container.bind<IHrEmployeeService>(TYPES.IHrEmployeeService).to(HrEmployeeService);
  container.bind<IPayrollProcessor>(TYPES.IPayrollProcessor).to(PayrollProcessor);
  container.bind<IAuthService>(TYPES.IAuthService).to(AuthService);
  container.bind<IFeatureGuard>(TYPES.IFeatureGuard).to(FeatureGuard);
  container.bind<IInventoryService>(TYPES.IInventoryService).to(InventoryService);

  return container;
}
