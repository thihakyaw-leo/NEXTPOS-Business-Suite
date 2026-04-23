#!/usr/bin/env node

/**
 * validate_costing.js
 *
 * End-to-end costing validator that:
 * 1. Connects to legacy MySQL, optionally through an SSH tunnel.
 * 2. Connects to Cloudflare D1 through the official HTTP API.
 * 3. Seeds a shared purchase/sale scenario into both systems.
 * 4. Executes sp_calculate_simpleprofitandloss on MySQL.
 * 5. Calls GET /api/reports/profit-loss on the Worker.
 * 6. Prints a discrepancy table for COGS, Gross Profit, and Inventory Value.
 *
 * Notes:
 * - No project dependencies are required. The script shells out to the system
 *   `mysql` and `ssh` binaries when needed.
 * - The repo does not contain the legacy stored procedure definition or the
 *   Worker report payload contract, so both are handled with sensible defaults
 *   plus env-based overrides.
 * - Default MySQL seed SQL assumes the migrated D1-style tables also exist in
 *   legacy MySQL. Override table names and/or extraction columns with env vars
 *   if your legacy schema differs.
 *
 * Required env:
 * - MYSQL_USER
 * - MYSQL_PASSWORD
 * - MYSQL_DATABASE
 * - CLOUDFLARE_ACCOUNT_ID
 * - CLOUDFLARE_D1_DATABASE_ID
 * - CLOUDFLARE_API_TOKEN
 * - WORKER_BASE_URL
 *
 * Common optional env:
 * - MYSQL_HOST=127.0.0.1
 * - MYSQL_PORT=3306
 * - MYSQL_CLIENT_BIN=mysql
 * - MYSQL_PROC_NAME=sp_calculate_simpleprofitandloss
 * - MYSQL_PROC_RESULTSET_INDEX=0
 * - MYSQL_COGS_COLUMN
 * - MYSQL_GROSS_PROFIT_COLUMN
 * - MYSQL_INVENTORY_VALUE_COLUMN
 * - SSH_HOST
 * - SSH_PORT=22
 * - SSH_USER
 * - SSH_DEST_HOST=127.0.0.1
 * - SSH_DEST_PORT=3306
 * - SSH_IDENTITY_FILE
 * - SSH_PRIVATE_KEY
 * - D1_SALES_MODE=worker|direct
 * - WORKER_SALES_PATH=/api/sales
 * - WORKER_REPORT_PATH=/api/reports/profit-loss
 * - WORKER_BEARER_TOKEN
 * - WORKER_HEADERS_JSON
 * - WORKER_SALES_HEADERS_JSON
 * - WORKER_REPORT_HEADERS_JSON
 * - WORKER_REPORT_QUERY_JSON
 * - WORKER_COGS_PATH
 * - WORKER_GROSS_PROFIT_PATH
 * - WORKER_INVENTORY_VALUE_PATH
 * - VALIDATION_CASE_JSON
 * - VALIDATION_CASE_FILE
 * - VALIDATION_COSTING_METHOD=FIFO|AVG
 * - VALIDATION_TOLERANCE=0.01
 * - VALIDATION_VERBOSE=true
 *
 * Optional table-name overrides:
 * - MYSQL_TENANTS_TABLE=tenants
 * - MYSQL_STOCK_TABLE=t_inventory_stock
 * - MYSQL_LEDGER_TABLE=inventory_ledger
 * - MYSQL_SALE_TABLE=tx_sale_sale
 * - MYSQL_SALE_DETAIL_TABLE=tx_sale_saledetail
 */

import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const env = process.env;
const VERBOSE = isTruthy(env.VALIDATION_VERBOSE);
const DEFAULT_TOLERANCE = Number(env.VALIDATION_TOLERANCE ?? 0.01);

const MYSQL_TABLES = {
  tenants: env.MYSQL_TENANTS_TABLE || 'tenants',
  stock: env.MYSQL_STOCK_TABLE || 't_inventory_stock',
  ledger: env.MYSQL_LEDGER_TABLE || 'inventory_ledger',
  sale: env.MYSQL_SALE_TABLE || 'tx_sale_sale',
  saleDetail: env.MYSQL_SALE_DETAIL_TABLE || 'tx_sale_saledetail',
};

const D1_TABLES = {
  tenants: 'tenants',
  stock: 't_inventory_stock',
  ledger: 'inventory_ledger',
  sale: 'tx_sale_sale',
  saleDetail: 'tx_sale_saledetail',
};

const DEFAULT_CASE = {
  tenantId: 'qa-costing-validation',
  companyCode: 'QA_COSTING',
  companyName: 'QA Costing Validation',
  email: 'qa-costing@example.com',
  currencyCode: 'MMK',
  timezone: 'Asia/Yangon',
  locationCode: 'MAIN',
  reportDateFrom: '2026-04-01',
  reportDateTo: '2026-04-30',
  costingMethod: 'FIFO',
  purchases: [
    {
      eventId: 'pur-001',
      transactionDate: '2026-04-01T09:00:00Z',
      itemCode: 'VAL-A',
      itemName: 'Validation Item A',
      barcode: 'VAL0000001',
      category: 'QA',
      unit: 'PCS',
      locationCode: 'MAIN',
      quantity: 10,
      costPrice: 100,
      sellingPrice: 180,
    },
    {
      eventId: 'pur-002',
      transactionDate: '2026-04-05T09:00:00Z',
      itemCode: 'VAL-A',
      itemName: 'Validation Item A',
      barcode: 'VAL0000001',
      category: 'QA',
      unit: 'PCS',
      locationCode: 'MAIN',
      quantity: 5,
      costPrice: 120,
      sellingPrice: 180,
    },
    {
      eventId: 'pur-003',
      transactionDate: '2026-04-02T09:30:00Z',
      itemCode: 'VAL-B',
      itemName: 'Validation Item B',
      barcode: 'VAL0000002',
      category: 'QA',
      unit: 'PCS',
      locationCode: 'MAIN',
      quantity: 8,
      costPrice: 50,
      sellingPrice: 80,
    },
  ],
  sales: [
    {
      eventId: 'sale-001',
      invoiceNo: 'VAL-S-001',
      saleDate: '2026-04-10T12:00:00Z',
      customerName: 'QA Walk In',
      customerPhone: '000000000',
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      details: [
        {
          itemCode: 'VAL-A',
          itemName: 'Validation Item A',
          locationCode: 'MAIN',
          quantity: 12,
          unitPrice: 180,
          discount: 0,
          tax: 0,
          lineTotal: 2160,
        },
      ],
    },
    {
      eventId: 'sale-002',
      invoiceNo: 'VAL-S-002',
      saleDate: '2026-04-11T15:00:00Z',
      customerName: 'QA Walk In',
      customerPhone: '000000000',
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      details: [
        {
          itemCode: 'VAL-B',
          itemName: 'Validation Item B',
          locationCode: 'MAIN',
          quantity: 3,
          unitPrice: 80,
          discount: 0,
          tax: 0,
          lineTotal: 240,
        },
      ],
    },
  ],
};

async function main() {
  const cleanupTasks = [];
  let tempKeyPath = null;

  try {
    const validationCase = await loadValidationCase();
    const config = buildConfig(validationCase);

    logVerbose('Loaded validation case', {
      tenantId: validationCase.tenantId,
      costingMethod: validationCase.costingMethod,
      purchases: validationCase.purchases.length,
      sales: validationCase.sales.length,
    });

    const simulation = simulateTransactions(validationCase);

    let mysqlHost = config.mysql.host;
    let mysqlPort = config.mysql.port;

    if (config.ssh.enabled) {
      const localPort = await getFreePort();
      const tunnel = await startSshTunnel({
        ssh: config.ssh,
        localPort,
      });

      cleanupTasks.push(async () => {
        await stopProcess(tunnel.process);
      });

      tempKeyPath = tunnel.tempKeyPath;
      mysqlHost = '127.0.0.1';
      mysqlPort = localPort;
    }

    const mysqlClient = {
      ...config.mysql,
      host: mysqlHost,
      port: mysqlPort,
    };

    const [schemaInfo, procedureParameters] = await Promise.all([
      discoverMySqlSchema(mysqlClient),
      discoverProcedureParameters(mysqlClient, config.mysql.procedureName),
    ]);

    logVerbose('Discovered MySQL schema', schemaInfo);
    logVerbose('Discovered procedure parameters', procedureParameters);

    await seedD1AndWorker(config, simulation);

    const mysqlProcedureResultSets = await seedMySqlAndRunProcedure(
      mysqlClient,
      schemaInfo,
      simulation,
      config,
      procedureParameters,
    );

    const mysqlMetrics = extractMySqlMetrics(mysqlProcedureResultSets, config.mysql);
    const workerPayload = await fetchWorkerProfitLoss(config, validationCase);
    const workerMetrics = extractWorkerMetrics(workerPayload, config.worker);
    const diffRows = buildDiffRows(mysqlMetrics, workerMetrics, config.tolerance);

    printRunSummary(validationCase, simulation);
    printDiffTable(diffRows);

    if (VERBOSE) {
      console.log('\nMySQL metrics:', formatMetricObject(mysqlMetrics));
      console.log('Worker metrics:', formatMetricObject(workerMetrics));
      console.log('Expected seed metrics:', formatMetricObject(simulation.expectedMetrics));
    }

    if (diffRows.some((row) => row.status !== 'MATCH')) {
      process.exitCode = 1;
      return;
    }

    process.exitCode = 0;
  } finally {
    for (const cleanup of cleanupTasks.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        logVerbose('Cleanup error', error);
      }
    }

    if (tempKeyPath) {
      try {
        await fs.unlink(tempKeyPath);
      } catch {
        // Ignore temp key cleanup errors.
      }
    }
  }
}

function buildConfig(validationCase) {
  requireEnv([
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'MYSQL_DATABASE',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_D1_DATABASE_ID',
    'CLOUDFLARE_API_TOKEN',
    'WORKER_BASE_URL',
  ]);

  const workerBaseUrl = trimTrailingSlash(env.WORKER_BASE_URL);
  const workerHeaders = safeJsonParse(env.WORKER_HEADERS_JSON, {});
  const workerSalesHeaders = safeJsonParse(env.WORKER_SALES_HEADERS_JSON, {});
  const workerReportHeaders = safeJsonParse(env.WORKER_REPORT_HEADERS_JSON, {});
  const workerTenantHeader = env.WORKER_TENANT_HEADER || 'X-Tenant-Id';

  if (env.WORKER_BEARER_TOKEN) {
    workerHeaders.Authorization = `Bearer ${env.WORKER_BEARER_TOKEN}`;
  }

  return {
    tolerance: Number.isFinite(DEFAULT_TOLERANCE) ? DEFAULT_TOLERANCE : 0.01,
    d1: {
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      databaseId: env.CLOUDFLARE_D1_DATABASE_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      salesMode: (env.D1_SALES_MODE || 'worker').toLowerCase(),
    },
    mysql: {
      host: env.MYSQL_HOST || '127.0.0.1',
      port: Number(env.MYSQL_PORT || 3306),
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      clientBin: env.MYSQL_CLIENT_BIN || 'mysql',
      procedureName: env.MYSQL_PROC_NAME || 'sp_calculate_simpleprofitandloss',
      resultSetIndex: parseInteger(env.MYSQL_PROC_RESULTSET_INDEX, 0),
      metricColumns: {
        cogs: env.MYSQL_COGS_COLUMN || null,
        grossProfit: env.MYSQL_GROSS_PROFIT_COLUMN || null,
        inventoryValue: env.MYSQL_INVENTORY_VALUE_COLUMN || null,
      },
    },
    ssh: {
      enabled: Boolean(env.SSH_HOST && env.SSH_USER),
      host: env.SSH_HOST || '',
      port: Number(env.SSH_PORT || 22),
      user: env.SSH_USER || '',
      identityFile: env.SSH_IDENTITY_FILE || '',
      privateKey: env.SSH_PRIVATE_KEY || '',
      destHost: env.SSH_DEST_HOST || env.MYSQL_HOST || '127.0.0.1',
      destPort: Number(env.SSH_DEST_PORT || env.MYSQL_PORT || 3306),
    },
    worker: {
      baseUrl: workerBaseUrl,
      salesUrl: makeAbsoluteUrl(workerBaseUrl, env.WORKER_SALES_PATH || '/api/sales'),
      reportUrl: makeAbsoluteUrl(workerBaseUrl, env.WORKER_REPORT_PATH || '/api/reports/profit-loss'),
      headers: {
        ...workerHeaders,
        [workerTenantHeader]: validationCase.tenantId,
      },
      salesHeaders: {
        ...workerHeaders,
        ...workerSalesHeaders,
        [workerTenantHeader]: validationCase.tenantId,
      },
      reportHeaders: {
        ...workerHeaders,
        ...workerReportHeaders,
        [workerTenantHeader]: validationCase.tenantId,
      },
      reportQuery: safeJsonParse(env.WORKER_REPORT_QUERY_JSON, null),
      metricPaths: {
        cogs: env.WORKER_COGS_PATH || '',
        grossProfit: env.WORKER_GROSS_PROFIT_PATH || '',
        inventoryValue: env.WORKER_INVENTORY_VALUE_PATH || '',
      },
    },
  };
}

async function loadValidationCase() {
  const inline = env.VALIDATION_CASE_JSON;
  const file = env.VALIDATION_CASE_FILE;
  const base = structuredClone(DEFAULT_CASE);

  if (!inline && !file) {
    base.costingMethod = normalizeCostingMethod(env.VALIDATION_COSTING_METHOD || base.costingMethod);
    return normalizeValidationCase(base);
  }

  let override = {};

  if (file) {
    const raw = await fs.readFile(path.resolve(file), 'utf8');
    override = safeJsonParse(raw, {}, 'VALIDATION_CASE_FILE');
  } else if (inline) {
    override = safeJsonParse(inline, {}, 'VALIDATION_CASE_JSON');
  }

  const merged = deepMerge(base, override);
  merged.costingMethod = normalizeCostingMethod(
    env.VALIDATION_COSTING_METHOD || merged.costingMethod,
  );

  return normalizeValidationCase(merged);
}

function normalizeValidationCase(input) {
  const normalized = {
    tenantId: String(input.tenantId || DEFAULT_CASE.tenantId),
    companyCode: String(input.companyCode || DEFAULT_CASE.companyCode),
    companyName: String(input.companyName || DEFAULT_CASE.companyName),
    email: String(input.email || DEFAULT_CASE.email),
    currencyCode: String(input.currencyCode || DEFAULT_CASE.currencyCode),
    timezone: String(input.timezone || DEFAULT_CASE.timezone),
    locationCode: String(input.locationCode || DEFAULT_CASE.locationCode),
    reportDateFrom: String(input.reportDateFrom || DEFAULT_CASE.reportDateFrom),
    reportDateTo: String(input.reportDateTo || DEFAULT_CASE.reportDateTo),
    costingMethod: normalizeCostingMethod(input.costingMethod || DEFAULT_CASE.costingMethod),
    purchases: Array.isArray(input.purchases) ? input.purchases : DEFAULT_CASE.purchases,
    sales: Array.isArray(input.sales) ? input.sales : DEFAULT_CASE.sales,
  };

  normalized.purchases = normalized.purchases.map((purchase, index) => ({
    eventId: String(purchase.eventId || `pur-${String(index + 1).padStart(3, '0')}`),
    transactionDate: String(purchase.transactionDate),
    itemCode: String(purchase.itemCode),
    itemName: String(purchase.itemName),
    barcode: purchase.barcode ? String(purchase.barcode) : null,
    category: purchase.category ? String(purchase.category) : null,
    unit: String(purchase.unit || 'PCS'),
    locationCode: String(purchase.locationCode || normalized.locationCode),
    quantity: roundQuantity(purchase.quantity),
    costPrice: roundCost(purchase.costPrice),
    sellingPrice: roundCurrency(purchase.sellingPrice),
  }));

  normalized.sales = normalized.sales.map((sale, saleIndex) => {
    const details = Array.isArray(sale.details) ? sale.details : [];
    const normalizedDetails = details.map((detail, detailIndex) => {
      const quantity = roundQuantity(detail.quantity);
      const unitPrice = roundCurrency(detail.unitPrice);
      const discount = roundCurrency(detail.discount ?? 0);
      const tax = roundCurrency(detail.tax ?? 0);
      const lineTotal =
        detail.lineTotal == null
          ? roundCurrency((unitPrice * quantity) - discount + tax)
          : roundCurrency(detail.lineTotal);

      return {
        detailId: String(
          detail.detailId || `${sale.invoiceNo || `sale-${saleIndex + 1}`}-line-${detailIndex + 1}`,
        ),
        itemCode: String(detail.itemCode),
        itemName: String(detail.itemName),
        locationCode: String(detail.locationCode || normalized.locationCode),
        quantity,
        unitPrice,
        discount,
        tax,
        lineTotal,
      };
    });

    const totalAmount = roundCurrency(
      normalizedDetails.reduce((sum, detail) => sum + detail.lineTotal, 0),
    );

    return {
      eventId: String(sale.eventId || `sale-${String(saleIndex + 1).padStart(3, '0')}`),
      invoiceNo: String(sale.invoiceNo || `VAL-S-${String(saleIndex + 1).padStart(3, '0')}`),
      saleDate: String(sale.saleDate),
      customerName: String(sale.customerName || 'Walk-in Customer'),
      customerPhone: sale.customerPhone ? String(sale.customerPhone) : '',
      paymentMethod: String(sale.paymentMethod || 'CASH').toUpperCase(),
      status: String(sale.status || 'COMPLETED').toUpperCase(),
      notes: sale.notes ? String(sale.notes) : null,
      totalAmount,
      taxAmount: roundCurrency(normalizedDetails.reduce((sum, detail) => sum + detail.tax, 0)),
      discountAmount: roundCurrency(
        normalizedDetails.reduce((sum, detail) => sum + detail.discount, 0),
      ),
      netAmount: totalAmount,
      details: normalizedDetails,
    };
  });

  return normalized;
}

function simulateTransactions(validationCase) {
  const state = new Map();
  const purchaseRefs = new Map();
  const events = [];
  let sequence = 0;
  let totalRevenue = 0;
  let totalCogs = 0;

  const orderedEvents = [
    ...validationCase.purchases.map((purchase, index) => ({
      kind: 'purchase',
      sortKey: sequenceSortKey(purchase.transactionDate, index, 'purchase'),
      payload: purchase,
    })),
    ...validationCase.sales.map((sale, index) => ({
      kind: 'sale',
      sortKey: sequenceSortKey(sale.saleDate, index, 'sale'),
      payload: sale,
    })),
  ].sort((left, right) => left.sortKey.localeCompare(right.sortKey));

  for (const event of orderedEvents) {
    if (event.kind === 'purchase') {
      const purchase = event.payload;
      const key = stockKey(purchase.itemCode, purchase.locationCode);
      const itemState = getOrCreateState(state, purchase);
      const quantityBefore = itemState.quantity;
      const avgCostBefore = itemState.avgCost;
      const newQuantity = roundQuantity(itemState.quantity + purchase.quantity);
      const weightedAvg =
        newQuantity > 0
          ? roundCost(
              ((itemState.quantity * itemState.avgCost) + (purchase.quantity * purchase.costPrice)) /
                newQuantity,
            )
          : itemState.avgCost;

      itemState.quantity = newQuantity;
      itemState.avgCost = weightedAvg;
      itemState.lastCostPrice = roundCost(purchase.costPrice);
      itemState.sellingPrice = roundCurrency(purchase.sellingPrice);
      itemState.itemName = purchase.itemName;
      itemState.barcode = purchase.barcode;
      itemState.category = purchase.category;
      itemState.unit = purchase.unit;
      itemState.layers.push({
        purchaseEventId: purchase.eventId,
        remainingQuantity: roundQuantity(purchase.quantity),
        costPrice: roundCost(purchase.costPrice),
        transactionDate: purchase.transactionDate,
      });

      const purchaseEvent = {
        kind: 'purchase',
        sequence: sequence++,
        eventId: purchase.eventId,
        transactionDate: purchase.transactionDate,
        itemCode: purchase.itemCode,
        itemName: purchase.itemName,
        locationCode: purchase.locationCode,
        barcode: purchase.barcode,
        category: purchase.category,
        unit: purchase.unit,
        quantity: purchase.quantity,
        costPrice: purchase.costPrice,
        sellingPrice: purchase.sellingPrice,
        quantityBefore,
        quantityAfter: itemState.quantity,
        avgCostBefore,
        avgCostAfter: itemState.avgCost,
        stockSnapshot: createStockSnapshot(validationCase.tenantId, purchase, itemState),
      };

      purchaseRefs.set(purchase.eventId, purchaseEvent);
      events.push(purchaseEvent);
      continue;
    }

    const sale = event.payload;
    const saleEvent = {
      kind: 'sale',
      sequence: sequence++,
      eventId: sale.eventId,
      invoiceNo: sale.invoiceNo,
      saleDate: sale.saleDate,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      notes: sale.notes,
      totalAmount: sale.totalAmount,
      taxAmount: sale.taxAmount,
      discountAmount: sale.discountAmount,
      netAmount: sale.netAmount,
      detailPlans: [],
      stockSnapshots: new Map(),
    };

    for (const detail of sale.details) {
      const key = stockKey(detail.itemCode, detail.locationCode);
      const itemState = state.get(key);

      if (!itemState || itemState.quantity < detail.quantity) {
        throw new Error(
          `Insufficient simulated stock for ${detail.itemCode} at ${detail.locationCode}: requested ${detail.quantity}, available ${itemState?.quantity ?? 0}`,
        );
      }

      const quantityBefore = itemState.quantity;
      const stockAvgCostBefore = itemState.avgCost;
      let unitCost = 0;
      let lineCogs = 0;
      const consumptions = [];

      if (validationCase.costingMethod === 'FIFO') {
        let remaining = detail.quantity;

        for (const layer of itemState.layers) {
          if (remaining <= 0) {
            break;
          }

          if (layer.remainingQuantity <= 0) {
            continue;
          }

          const consumeQuantity = Math.min(layer.remainingQuantity, remaining);
          const consumptionCost = roundCurrency(consumeQuantity * layer.costPrice);

          layer.remainingQuantity = roundQuantity(layer.remainingQuantity - consumeQuantity);
          remaining = roundQuantity(remaining - consumeQuantity);
          lineCogs = roundCurrency(lineCogs + consumptionCost);

          consumptions.push({
            purchaseEventId: layer.purchaseEventId,
            consumeQuantity,
            costPrice: layer.costPrice,
            lineCogs: consumptionCost,
            sourcePurchase: purchaseRefs.get(layer.purchaseEventId),
          });
        }

        if (remaining > 0) {
          throw new Error(`FIFO simulation failed to fully cost ${detail.itemCode}`);
        }

        unitCost = detail.quantity > 0 ? roundCost(lineCogs / detail.quantity) : 0;
      } else {
        unitCost = roundCost(itemState.avgCost || itemState.lastCostPrice || 0);
        lineCogs = roundCurrency(unitCost * detail.quantity);
        consumptions.push({
          purchaseEventId: null,
          consumeQuantity: detail.quantity,
          costPrice: unitCost,
          lineCogs,
          sourcePurchase: null,
        });
      }

      itemState.quantity = roundQuantity(itemState.quantity - detail.quantity);
      totalRevenue = roundCurrency(totalRevenue + detail.lineTotal);
      totalCogs = roundCurrency(totalCogs + lineCogs);

      const detailPlan = {
        detailId: detail.detailId,
        itemCode: detail.itemCode,
        itemName: detail.itemName,
        locationCode: detail.locationCode,
        quantity: detail.quantity,
        unitPrice: detail.unitPrice,
        discount: detail.discount,
        tax: detail.tax,
        lineTotal: detail.lineTotal,
        quantityBefore,
        quantityAfter: itemState.quantity,
        stockAvgCostBefore,
        unitCost,
        lineCogs,
        consumptions,
      };

      saleEvent.detailPlans.push(detailPlan);
      saleEvent.stockSnapshots.set(
        key,
        createStockSnapshot(validationCase.tenantId, detail, itemState),
      );
    }

    events.push(saleEvent);
  }

  const expectedGrossProfit = roundCurrency(totalRevenue - totalCogs);
  let expectedInventoryValue = 0;

  for (const itemState of state.values()) {
    if (validationCase.costingMethod === 'FIFO') {
      expectedInventoryValue = roundCurrency(
        expectedInventoryValue +
          itemState.layers.reduce(
            (sum, layer) => roundCurrency(sum + (layer.remainingQuantity * layer.costPrice)),
            0,
          ),
      );
    } else {
      expectedInventoryValue = roundCurrency(
        expectedInventoryValue + (itemState.quantity * itemState.avgCost),
      );
    }
  }

  return {
    validationCase,
    events,
    expectedMetrics: {
      cogs: totalCogs,
      grossProfit: expectedGrossProfit,
      inventoryValue: expectedInventoryValue,
    },
  };
}

async function seedD1AndWorker(config, simulation) {
  await d1Batch(config.d1, [
    { sql: `DELETE FROM ${D1_TABLES.saleDetail} WHERE tenant_id = ?`, params: [simulation.validationCase.tenantId] },
    { sql: `DELETE FROM ${D1_TABLES.sale} WHERE tenant_id = ?`, params: [simulation.validationCase.tenantId] },
    { sql: `DELETE FROM ${D1_TABLES.ledger} WHERE tenant_id = ?`, params: [simulation.validationCase.tenantId] },
    { sql: `DELETE FROM ${D1_TABLES.stock} WHERE tenant_id = ?`, params: [simulation.validationCase.tenantId] },
    { sql: `DELETE FROM ${D1_TABLES.tenants} WHERE tenant_id = ?`, params: [simulation.validationCase.tenantId] },
    {
      sql: `
        INSERT INTO ${D1_TABLES.tenants}
          (tenant_id, company_code, company_name, email, currency_code, timezone, plan_type, enabled_features, isdeleted, createdate, updatedate)
        VALUES (?, ?, ?, ?, ?, ?, 'enterprise', '["sales.write","sales.read","reports.read","inventory.read"]', 0, ?, ?)
      `,
      params: [
        simulation.validationCase.tenantId,
        simulation.validationCase.companyCode,
        simulation.validationCase.companyName,
        simulation.validationCase.email,
        simulation.validationCase.currencyCode,
        simulation.validationCase.timezone,
        nowIso(),
        nowIso(),
      ],
    },
  ]);

  const purchaseLedgerIds = new Map();

  for (const event of simulation.events) {
    if (event.kind === 'purchase') {
      const stock = event.stockSnapshot;

      await d1Batch(config.d1, [
        {
          sql: `DELETE FROM ${D1_TABLES.stock} WHERE tenant_id = ? AND item_code = ? AND location_code = ?`,
          params: [stock.tenant_id, stock.item_code, stock.location_code],
        },
        {
          sql: `
            INSERT INTO ${D1_TABLES.stock}
              (tenant_id, item_code, item_name, barcode, category, unit, location_code,
               quantity_on_hand, reorder_level, cost_price, avg_cost, selling_price,
               isdeleted, createdate, updatedate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?)
          `,
          params: [
            stock.tenant_id,
            stock.item_code,
            stock.item_name,
            stock.barcode,
            stock.category,
            stock.unit,
            stock.location_code,
            stock.quantity_on_hand,
            stock.cost_price,
            stock.avg_cost,
            stock.selling_price,
            event.transactionDate,
            event.transactionDate,
          ],
        },
      ]);

      const ledgerInsert = await d1Query(config.d1, `
        INSERT INTO ${D1_TABLES.ledger}
          (tenant_id, item_code, location_code, transaction_type, reference_type, reference_id,
           quantity_change, quantity_before, quantity_after, cost_price, source_ledger_id, remarks,
           transaction_date, isdeleted, createdate, updatedate)
        VALUES (?, ?, ?, 'PURCHASE', 'PURCHASE', NULL, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)
      `, [
        stock.tenant_id,
        stock.item_code,
        stock.location_code,
        event.quantity,
        event.quantityBefore,
        event.quantityAfter,
        event.costPrice,
        `Validation purchase ${event.eventId}`,
        event.transactionDate,
        event.transactionDate,
        event.transactionDate,
      ]);

      purchaseLedgerIds.set(event.eventId, getLastInsertId(ledgerInsert));
      continue;
    }

    if (config.d1.salesMode === 'worker') {
      await postSingleSaleToWorker(config, simulation.validationCase, event);
    } else {
      await seedSingleSaleDirectlyIntoD1(config, simulation, event, purchaseLedgerIds);
    }
  }
}

async function seedSingleSaleDirectlyIntoD1(config, simulation, event, purchaseLedgerIds = new Map()) {
  const saleInsert = await d1Query(config.d1, `
      INSERT INTO ${D1_TABLES.sale}
        (tenant_id, sale_number, sale_date, customer_name, customer_phone, total_amount,
         tax_amount, discount_amount, net_amount, payment_method, status, notes,
         isdeleted, createdate, updatedate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      simulation.validationCase.tenantId,
      event.invoiceNo,
      event.saleDate,
      event.customerName,
      event.customerPhone,
      event.totalAmount,
      event.taxAmount,
      event.discountAmount,
      event.netAmount,
      event.paymentMethod,
      event.status,
      event.notes,
      event.saleDate,
      event.saleDate,
    ]);

  const saleId = getLastInsertId(saleInsert);

  for (const detail of event.detailPlans) {
    await d1Query(config.d1, `
        INSERT INTO ${D1_TABLES.saleDetail}
          (tenant_id, sale_id, item_code, item_name, quantity, unit_price, discount, tax,
           line_total, cost_price, isdeleted, createdate, updatedate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        simulation.validationCase.tenantId,
        saleId,
        detail.itemCode,
        detail.itemName,
        detail.quantity,
        detail.unitPrice,
        detail.discount,
        detail.tax,
        detail.lineTotal,
        detail.unitCost,
        event.saleDate,
        event.saleDate,
      ]);

    if (simulation.validationCase.costingMethod === 'FIFO') {
      for (const consumption of detail.consumptions) {
        await d1Query(config.d1, `
            INSERT INTO ${D1_TABLES.ledger}
              (tenant_id, item_code, location_code, transaction_type, reference_type, reference_id,
               quantity_change, quantity_before, quantity_after, cost_price, source_ledger_id, remarks,
               transaction_date, isdeleted, createdate, updatedate)
            VALUES (?, ?, ?, 'SALE_FIFO_CONSUMPTION', 'SALE', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `, [
          simulation.validationCase.tenantId,
          detail.itemCode,
          detail.locationCode,
          saleId,
          -consumption.consumeQuantity,
          detail.quantityBefore,
          detail.quantityAfter,
          consumption.costPrice,
          purchaseLedgerIds.get(consumption.purchaseEventId) ?? null,
          `Validation FIFO consumption for ${event.invoiceNo}`,
          event.saleDate,
          event.saleDate,
          event.saleDate,
        ]);
      }
    } else {
      await d1Query(config.d1, `
          INSERT INTO ${D1_TABLES.ledger}
            (tenant_id, item_code, location_code, transaction_type, reference_type, reference_id,
             quantity_change, quantity_before, quantity_after, cost_price, source_ledger_id, remarks,
             transaction_date, isdeleted, createdate, updatedate)
          VALUES (?, ?, ?, 'SALE_AVG_CONSUMPTION', 'SALE', ?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)
      `, [
        simulation.validationCase.tenantId,
        detail.itemCode,
        detail.locationCode,
        saleId,
        -detail.quantity,
        detail.quantityBefore,
        detail.quantityAfter,
        detail.unitCost,
        `Validation AVG consumption for ${event.invoiceNo}`,
        event.saleDate,
        event.saleDate,
        event.saleDate,
      ]);
    }
  }

  for (const stock of event.stockSnapshots.values()) {
    await d1Batch(config.d1, [
      {
        sql: `DELETE FROM ${D1_TABLES.stock} WHERE tenant_id = ? AND item_code = ? AND location_code = ?`,
        params: [stock.tenant_id, stock.item_code, stock.location_code],
      },
      {
        sql: `
          INSERT INTO ${D1_TABLES.stock}
            (tenant_id, item_code, item_name, barcode, category, unit, location_code,
             quantity_on_hand, reorder_level, cost_price, avg_cost, selling_price,
             isdeleted, createdate, updatedate)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?)
        `,
        params: [
          stock.tenant_id,
          stock.item_code,
          stock.item_name,
          stock.barcode,
          stock.category,
          stock.unit,
          stock.location_code,
          stock.quantity_on_hand,
          stock.cost_price,
          stock.avg_cost,
          stock.selling_price,
          event.saleDate,
          event.saleDate,
        ],
      },
    ]);
  }
}

async function postSingleSaleToWorker(config, validationCase, sale) {
  const body = {
    sale: {
      tenant_id: validationCase.tenantId,
      invoice_no: sale.invoiceNo,
      sale_date: sale.saleDate,
      customer_name: sale.customerName,
      customer_phone: sale.customerPhone,
      total_amount: sale.totalAmount,
      tax_amount: sale.taxAmount,
      discount_amount: sale.discountAmount,
      net_amount: sale.netAmount,
      payment_method: sale.paymentMethod,
      status: sale.status,
      notes: sale.notes,
      costing_method: validationCase.costingMethod,
    },
    details: sale.detailPlans.map((detail) => ({
      item_code: detail.itemCode,
      item_name: detail.itemName,
      location_code: detail.locationCode,
      quantity: detail.quantity,
      unit_price: detail.unitPrice,
      discount: detail.discount,
      tax: detail.tax,
      line_total: detail.lineTotal,
    })),
  };

  const response = await fetch(config.worker.salesUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...config.worker.salesHeaders,
    },
    body: JSON.stringify(body),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok || payload?.success === false) {
    throw new Error(
      `Worker sale seed failed for ${sale.invoiceNo}: ${response.status} ${JSON.stringify(payload)}`,
    );
  }
}

async function discoverMySqlSchema(mysqlClient) {
  const tableNames = Object.values(MYSQL_TABLES);
  const sql = `
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (${tableNames.map(() => '?').join(', ')})
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `;
  const resultSets = await runMySqlQuery(mysqlClient, sql, tableNames);
  const rows = firstResultSet(resultSets);
  const schema = {};

  for (const row of rows) {
    const tableName = row.TABLE_NAME || row.table_name;
    const columnName = row.COLUMN_NAME || row.column_name;

    if (!schema[tableName]) {
      schema[tableName] = new Set();
    }

    schema[tableName].add(columnName);
  }

  return schema;
}

async function discoverProcedureParameters(mysqlClient, procedureName) {
  const sql = `
    SELECT ORDINAL_POSITION, PARAMETER_MODE, PARAMETER_NAME, DTD_IDENTIFIER
    FROM INFORMATION_SCHEMA.PARAMETERS
    WHERE SPECIFIC_SCHEMA = DATABASE()
      AND SPECIFIC_NAME = ?
    ORDER BY ORDINAL_POSITION
  `;
  const resultSets = await runMySqlQuery(mysqlClient, sql, [procedureName]);
  return firstResultSet(resultSets).map((row) => ({
    position: Number(row.ORDINAL_POSITION ?? row.ordinal_position ?? 0),
    mode: String(row.PARAMETER_MODE ?? row.parameter_mode ?? 'IN').toUpperCase(),
    name: String(row.PARAMETER_NAME ?? row.parameter_name ?? ''),
    type: String(row.DTD_IDENTIFIER ?? row.dtd_identifier ?? ''),
  }));
}

async function seedMySqlAndRunProcedure(
  mysqlClient,
  schemaInfo,
  simulation,
  config,
  procedureParameters,
) {
  const script = buildMySqlSeedAndProcedureScript(
    schemaInfo,
    simulation,
    config,
    procedureParameters,
  );

  logVerbose('Generated MySQL script', script);

  const resultSets = await runMySqlScript(mysqlClient, script);
  const callResultSets = extractProcedureResultSets(resultSets);

  if (callResultSets.length === 0) {
    throw new Error('Stored procedure returned no result sets between markers.');
  }

  return callResultSets;
}

function buildMySqlSeedAndProcedureScript(schemaInfo, simulation, config, procedureParameters) {
  const statements = [];
  const tenantId = simulation.validationCase.tenantId;

  statements.push('SET @__proc_marker := 1;');

  if (hasTable(schemaInfo, MYSQL_TABLES.saleDetail) && hasColumn(schemaInfo, MYSQL_TABLES.saleDetail, 'tenant_id')) {
    statements.push(
      `DELETE FROM ${quoteIdent(MYSQL_TABLES.saleDetail)} WHERE ${quoteIdent('tenant_id')} = ${sqlLiteral(tenantId)};`,
    );
  }

  if (hasTable(schemaInfo, MYSQL_TABLES.sale) && hasColumn(schemaInfo, MYSQL_TABLES.sale, 'tenant_id')) {
    statements.push(
      `DELETE FROM ${quoteIdent(MYSQL_TABLES.sale)} WHERE ${quoteIdent('tenant_id')} = ${sqlLiteral(tenantId)};`,
    );
  }

  if (hasTable(schemaInfo, MYSQL_TABLES.ledger) && hasColumn(schemaInfo, MYSQL_TABLES.ledger, 'tenant_id')) {
    statements.push(
      `DELETE FROM ${quoteIdent(MYSQL_TABLES.ledger)} WHERE ${quoteIdent('tenant_id')} = ${sqlLiteral(tenantId)};`,
    );
  }

  if (hasTable(schemaInfo, MYSQL_TABLES.stock) && hasColumn(schemaInfo, MYSQL_TABLES.stock, 'tenant_id')) {
    statements.push(
      `DELETE FROM ${quoteIdent(MYSQL_TABLES.stock)} WHERE ${quoteIdent('tenant_id')} = ${sqlLiteral(tenantId)};`,
    );
  }

  if (hasTable(schemaInfo, MYSQL_TABLES.tenants) && hasColumn(schemaInfo, MYSQL_TABLES.tenants, 'tenant_id')) {
    statements.push(
      `DELETE FROM ${quoteIdent(MYSQL_TABLES.tenants)} WHERE ${quoteIdent('tenant_id')} = ${sqlLiteral(tenantId)};`,
    );
  }

  const tenantColumns = getColumns(schemaInfo, MYSQL_TABLES.tenants);

  if (tenantColumns.size > 0) {
    statements.push(
      buildInsertStatement(MYSQL_TABLES.tenants, tenantColumns, {
        tenant_id: simulation.validationCase.tenantId,
        company_code: simulation.validationCase.companyCode,
        company_name: simulation.validationCase.companyName,
        email: simulation.validationCase.email,
        currency_code: simulation.validationCase.currencyCode,
        timezone: simulation.validationCase.timezone,
        plan_type: 'enterprise',
        enabled_features: '["sales.write","sales.read","reports.read","inventory.read"]',
        isdeleted: 0,
        createdate: nowIso(),
        updatedate: nowIso(),
      }),
    );
  }

  for (const event of simulation.events) {
    if (event.kind === 'purchase') {
      statements.push(...buildMySqlPurchaseStatements(schemaInfo, simulation, event));
    } else {
      statements.push(...buildMySqlSaleStatements(schemaInfo, simulation, event));
    }
  }

  statements.push(`SELECT '__PROC_START__' AS __marker__;`);
  statements.push(buildProcedureCallStatement(simulation.validationCase, config.mysql.procedureName, procedureParameters));
  statements.push(`SELECT '__PROC_END__' AS __marker__;`);

  return statements.join('\n');
}

function buildMySqlPurchaseStatements(schemaInfo, simulation, event) {
  const statements = [];
  const stockColumns = getColumns(schemaInfo, MYSQL_TABLES.stock);
  const ledgerColumns = getColumns(schemaInfo, MYSQL_TABLES.ledger);
  const stock = event.stockSnapshot;

  if (stockColumns.size === 0) {
    throw new Error(`MySQL stock table ${MYSQL_TABLES.stock} was not found in INFORMATION_SCHEMA.`);
  }

  statements.push(
    `DELETE FROM ${quoteIdent(MYSQL_TABLES.stock)}
     WHERE ${quoteIdent('tenant_id')} = ${sqlLiteral(stock.tenant_id)}
       AND ${quoteIdent('item_code')} = ${sqlLiteral(stock.item_code)}
       AND ${quoteIdent('location_code')} = ${sqlLiteral(stock.location_code)};`,
  );

  statements.push(
    buildInsertStatement(MYSQL_TABLES.stock, stockColumns, {
      tenant_id: stock.tenant_id,
      item_code: stock.item_code,
      item_name: stock.item_name,
      barcode: stock.barcode,
      category: stock.category,
      unit: stock.unit,
      location_code: stock.location_code,
      quantity_on_hand: stock.quantity_on_hand,
      reorder_level: 0,
      cost_price: stock.cost_price,
      avg_cost: stock.avg_cost,
      selling_price: stock.selling_price,
      isdeleted: 0,
      createdate: event.transactionDate,
      updatedate: event.transactionDate,
    }),
  );

  if (ledgerColumns.size > 0) {
    statements.push(
      buildInsertStatement(MYSQL_TABLES.ledger, ledgerColumns, {
        tenant_id: stock.tenant_id,
        item_code: stock.item_code,
        location_code: stock.location_code,
        transaction_type: 'PURCHASE',
        reference_type: 'PURCHASE',
        reference_id: null,
        quantity_change: event.quantity,
        quantity_before: event.quantityBefore,
        quantity_after: event.quantityAfter,
        cost_price: event.costPrice,
        source_ledger_id: null,
        remarks: `Validation purchase ${event.eventId}`,
        transaction_date: event.transactionDate,
        isdeleted: 0,
        createdate: event.transactionDate,
        updatedate: event.transactionDate,
      }),
    );
    statements.push(`SET @ledger_${sanitizeVariableName(event.eventId)} := LAST_INSERT_ID();`);
  }

  return statements;
}

function buildMySqlSaleStatements(schemaInfo, simulation, event) {
  const statements = [];
  const saleColumns = getColumns(schemaInfo, MYSQL_TABLES.sale);
  const saleDetailColumns = getColumns(schemaInfo, MYSQL_TABLES.saleDetail);
  const ledgerColumns = getColumns(schemaInfo, MYSQL_TABLES.ledger);
  const stockColumns = getColumns(schemaInfo, MYSQL_TABLES.stock);

  if (saleColumns.size === 0) {
    throw new Error(`MySQL sale table ${MYSQL_TABLES.sale} was not found in INFORMATION_SCHEMA.`);
  }

  statements.push(
    buildInsertStatement(MYSQL_TABLES.sale, saleColumns, {
      tenant_id: simulation.validationCase.tenantId,
      sale_number: event.invoiceNo,
      sale_date: event.saleDate,
      customer_name: event.customerName,
      customer_phone: event.customerPhone,
      total_amount: event.totalAmount,
      tax_amount: event.taxAmount,
      discount_amount: event.discountAmount,
      net_amount: event.netAmount,
      payment_method: event.paymentMethod,
      status: event.status,
      notes: event.notes,
      delivery_fee: 0,
      delivery_cost: 0,
      isdeleted: 0,
      createdate: event.saleDate,
      updatedate: event.saleDate,
    }),
  );
  statements.push(`SET @sale_${sanitizeVariableName(event.invoiceNo)} := LAST_INSERT_ID();`);

  for (const detail of event.detailPlans) {
    const detailValues = {
      tenant_id: simulation.validationCase.tenantId,
      sale_id: `@sale_${sanitizeVariableName(event.invoiceNo)}`,
      item_code: detail.itemCode,
      item_name: detail.itemName,
      quantity: detail.quantity,
      unit_price: detail.unitPrice,
      discount: detail.discount,
      tax: detail.tax,
      line_total: detail.lineTotal,
      cost_price: detail.unitCost,
      isdeleted: 0,
      createdate: event.saleDate,
      updatedate: event.saleDate,
    };

    statements.push(
      buildInsertStatement(MYSQL_TABLES.saleDetail, saleDetailColumns, detailValues, {
        rawColumns: new Set(['sale_id']),
      }),
    );

    if (ledgerColumns.size > 0) {
      if (simulation.validationCase.costingMethod === 'FIFO') {
        for (const consumption of detail.consumptions) {
          statements.push(
            buildInsertStatement(MYSQL_TABLES.ledger, ledgerColumns, {
              tenant_id: simulation.validationCase.tenantId,
              item_code: detail.itemCode,
              location_code: detail.locationCode,
              transaction_type: 'SALE_FIFO_CONSUMPTION',
              reference_type: 'SALE',
              reference_id: `@sale_${sanitizeVariableName(event.invoiceNo)}`,
              quantity_change: -consumption.consumeQuantity,
              quantity_before: detail.quantityBefore,
              quantity_after: detail.quantityAfter,
              cost_price: consumption.costPrice,
              source_ledger_id: consumption.purchaseEventId
                ? `@ledger_${sanitizeVariableName(consumption.purchaseEventId)}`
                : null,
              remarks: `Validation FIFO consumption for ${event.invoiceNo}`,
              transaction_date: event.saleDate,
              isdeleted: 0,
              createdate: event.saleDate,
              updatedate: event.saleDate,
            }, {
              rawColumns: new Set(['reference_id', 'source_ledger_id']),
            }),
          );
        }
      } else {
        statements.push(
          buildInsertStatement(MYSQL_TABLES.ledger, ledgerColumns, {
            tenant_id: simulation.validationCase.tenantId,
            item_code: detail.itemCode,
            location_code: detail.locationCode,
            transaction_type: 'SALE_AVG_CONSUMPTION',
            reference_type: 'SALE',
            reference_id: `@sale_${sanitizeVariableName(event.invoiceNo)}`,
            quantity_change: -detail.quantity,
            quantity_before: detail.quantityBefore,
            quantity_after: detail.quantityAfter,
            cost_price: detail.unitCost,
            source_ledger_id: null,
            remarks: `Validation AVG consumption for ${event.invoiceNo}`,
            transaction_date: event.saleDate,
            isdeleted: 0,
            createdate: event.saleDate,
            updatedate: event.saleDate,
          }, {
            rawColumns: new Set(['reference_id']),
          }),
        );
      }
    }
  }

  for (const stock of event.stockSnapshots.values()) {
    statements.push(
      `DELETE FROM ${quoteIdent(MYSQL_TABLES.stock)}
       WHERE ${quoteIdent('tenant_id')} = ${sqlLiteral(stock.tenant_id)}
         AND ${quoteIdent('item_code')} = ${sqlLiteral(stock.item_code)}
         AND ${quoteIdent('location_code')} = ${sqlLiteral(stock.location_code)};`,
    );

    statements.push(
      buildInsertStatement(MYSQL_TABLES.stock, stockColumns, {
        tenant_id: stock.tenant_id,
        item_code: stock.item_code,
        item_name: stock.item_name,
        barcode: stock.barcode,
        category: stock.category,
        unit: stock.unit,
        location_code: stock.location_code,
        quantity_on_hand: stock.quantity_on_hand,
        reorder_level: 0,
        cost_price: stock.cost_price,
        avg_cost: stock.avg_cost,
        selling_price: stock.selling_price,
        isdeleted: 0,
        createdate: event.saleDate,
        updatedate: event.saleDate,
      }),
    );
  }

  return statements;
}

function buildProcedureCallStatement(validationCase, procedureName, parameters) {
  if (env.MYSQL_PROC_CALL_SQL) {
    return env.MYSQL_PROC_CALL_SQL.endsWith(';')
      ? env.MYSQL_PROC_CALL_SQL
      : `${env.MYSQL_PROC_CALL_SQL};`;
  }

  if (!parameters || parameters.length === 0) {
    return `CALL ${quoteIdent(procedureName)}();`;
  }

  const args = parameters.map((parameter) =>
    inferProcedureArgument(validationCase, parameter),
  );

  return `CALL ${quoteIdent(procedureName)}(${args.join(', ')});`;
}

function inferProcedureArgument(validationCase, parameter) {
  const name = normalizeKey(parameter.name || '');
  const explicit = env[`MYSQL_PROC_ARG_${parameter.position}`];

  if (explicit != null) {
    return sqlLiteral(explicit);
  }

  if (parameter.mode === 'OUT' || parameter.mode === 'INOUT') {
    return `@proc_out_${parameter.position}`;
  }

  if (name.includes('tenant')) {
    return sqlLiteral(validationCase.tenantId);
  }

  if (name.includes('company')) {
    return sqlLiteral(validationCase.companyCode);
  }

  if ((name.includes('date') || name.includes('dt')) && (name.includes('from') || name.includes('start'))) {
    return sqlLiteral(validationCase.reportDateFrom);
  }

  if ((name.includes('date') || name.includes('dt')) && (name.includes('to') || name.includes('end'))) {
    return sqlLiteral(validationCase.reportDateTo);
  }

  if (name.includes('location') || name.includes('branch') || name.includes('warehouse')) {
    return sqlLiteral(validationCase.locationCode);
  }

  if (name.includes('method') || name.includes('costing')) {
    return sqlLiteral(validationCase.costingMethod);
  }

  return 'NULL';
}

async function fetchWorkerProfitLoss(config, validationCase) {
  const url = new URL(config.worker.reportUrl);
  const query = config.worker.reportQuery || {
    tenant_id: validationCase.tenantId,
    date_from: validationCase.reportDateFrom,
    date_to: validationCase.reportDateTo,
    start_date: validationCase.reportDateFrom,
    end_date: validationCase.reportDateTo,
    from: validationCase.reportDateFrom,
    to: validationCase.reportDateTo,
  };

  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: config.worker.reportHeaders,
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok || payload?.success === false) {
    throw new Error(
      `Worker profit/loss request failed: ${response.status} ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

function extractMySqlMetrics(resultSets, mysqlConfig) {
  const index = mysqlConfig.resultSetIndex;
  const selected = resultSets[index];

  if (!selected) {
    throw new Error(
      `MySQL procedure result set index ${index} is out of range. Available sets: ${resultSets.length}`,
    );
  }

  return {
    cogs: extractMetricFromRows(
      selected.rows,
      ['cogs', 'total_cogs', 'cost_of_goods_sold', 'costofgoodssold'],
      mysqlConfig.metricColumns.cogs,
      'MySQL',
    ),
    grossProfit: extractMetricFromRows(
      selected.rows,
      ['gross_profit', 'grossprofit', 'profit', 'gross_margin'],
      mysqlConfig.metricColumns.grossProfit,
      'MySQL',
    ),
    inventoryValue: extractMetricFromRows(
      selected.rows,
      ['inventory_value', 'inventoryvalue', 'closing_inventory', 'closinginventory', 'stock_value', 'stockvalue'],
      mysqlConfig.metricColumns.inventoryValue,
      'MySQL',
    ),
  };
}

function extractWorkerMetrics(payload, workerConfig) {
  return {
    cogs: extractMetricFromPayload(
      payload,
      ['cogs', 'total_cogs', 'cost_of_goods_sold', 'costofgoodssold'],
      workerConfig.metricPaths.cogs,
      'Worker COGS',
    ),
    grossProfit: extractMetricFromPayload(
      payload,
      ['gross_profit', 'grossprofit', 'profit', 'gross_margin'],
      workerConfig.metricPaths.grossProfit,
      'Worker Gross Profit',
    ),
    inventoryValue: extractMetricFromPayload(
      payload,
      ['inventory_value', 'inventoryvalue', 'closing_inventory', 'closinginventory', 'stock_value', 'stockvalue'],
      workerConfig.metricPaths.inventoryValue,
      'Worker Inventory Value',
    ),
  };
}

function extractMetricFromRows(rows, aliases, explicitColumn, sourceLabel) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${sourceLabel} result set was empty.`);
  }

  if (explicitColumn) {
    const total = rows.reduce((sum, row) => sum + coerceNumber(row[explicitColumn]), 0);
    if (Number.isFinite(total)) {
      return roundCurrency(total);
    }
  }

  const aliasSet = new Set(aliases.map(normalizeKey));
  const rowKeys = Object.keys(rows[0]);

  for (const key of rowKeys) {
    if (aliasSet.has(normalizeKey(key))) {
      const total = rows.reduce((sum, row) => sum + coerceNumber(row[key]), 0);
      return roundCurrency(total);
    }
  }

  if (rows.length === 1) {
    const value = recursiveMetricSearch(rows[0], aliasSet);
    if (value != null) {
      return roundCurrency(value);
    }
  }

  throw new Error(
    `${sourceLabel} metric could not be extracted. Available columns: ${rowKeys.join(', ')}`,
  );
}

function extractMetricFromPayload(payload, aliases, explicitPath, label) {
  if (explicitPath) {
    const explicitValue = getPathValue(payload, explicitPath);
    const numeric = coerceNumber(explicitValue);
    if (Number.isFinite(numeric)) {
      return roundCurrency(numeric);
    }
  }

  const aliasSet = new Set(aliases.map(normalizeKey));
  const containers = collectLikelyContainers(payload);

  for (const container of containers) {
    const value = extractMetricFromContainer(container, aliasSet);
    if (value != null) {
      return roundCurrency(value);
    }
  }

  throw new Error(`${label} could not be extracted from Worker payload.`);
}

function collectLikelyContainers(payload) {
  const containers = [];
  const candidates = [
    payload,
    payload?.data,
    payload?.summary,
    payload?.result,
    payload?.data?.summary,
    payload?.data?.result,
    payload?.report,
    payload?.data?.report,
    payload?.rows,
    payload?.data?.rows,
  ];

  for (const candidate of candidates) {
    if (candidate && !containers.includes(candidate)) {
      containers.push(candidate);
    }
  }

  return containers;
}

function extractMetricFromContainer(container, aliasSet) {
  if (container == null) {
    return null;
  }

  if (Array.isArray(container)) {
    let found = false;
    let total = 0;

    for (const entry of container) {
      if (entry && typeof entry === 'object') {
        for (const [key, value] of Object.entries(entry)) {
          if (aliasSet.has(normalizeKey(key))) {
            total += coerceNumber(value);
            found = true;
          }
        }
      }
    }

    return found ? total : null;
  }

  if (typeof container === 'object') {
    for (const [key, value] of Object.entries(container)) {
      if (aliasSet.has(normalizeKey(key))) {
        return coerceNumber(value);
      }
    }

    return recursiveMetricSearch(container, aliasSet);
  }

  return null;
}

function recursiveMetricSearch(value, aliasSet, seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) {
    return null;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    let total = 0;
    let found = false;

    for (const item of value) {
      const child = recursiveMetricSearch(item, aliasSet, seen);
      if (child != null) {
        total += child;
        found = true;
      }
    }

    return found ? total : null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (aliasSet.has(normalizeKey(key))) {
      return coerceNumber(child);
    }
  }

  for (const child of Object.values(value)) {
    const result = recursiveMetricSearch(child, aliasSet, seen);
    if (result != null) {
      return result;
    }
  }

  return null;
}

function buildDiffRows(mysqlMetrics, workerMetrics, tolerance) {
  return [
    buildDiffRow('COGS', mysqlMetrics.cogs, workerMetrics.cogs, tolerance),
    buildDiffRow('Gross Profit', mysqlMetrics.grossProfit, workerMetrics.grossProfit, tolerance),
    buildDiffRow('Inventory Value', mysqlMetrics.inventoryValue, workerMetrics.inventoryValue, tolerance),
  ];
}

function buildDiffRow(metric, mysqlValue, workerValue, tolerance) {
  const delta = roundCurrency(workerValue - mysqlValue);
  const status = Math.abs(delta) <= tolerance ? 'MATCH' : 'DIFF';

  return {
    metric,
    mysqlValue: roundCurrency(mysqlValue),
    workerValue: roundCurrency(workerValue),
    delta,
    status,
  };
}

function printRunSummary(validationCase, simulation) {
  console.log(`\nValidation case: ${validationCase.tenantId}`);
  console.log(
    `Date range: ${validationCase.reportDateFrom} to ${validationCase.reportDateTo} | Method: ${validationCase.costingMethod}`,
  );
  console.log(
    `Purchases: ${validationCase.purchases.length} | Sales: ${validationCase.sales.length} | Expected revenue: ${formatMoney(simulation.expectedMetrics.grossProfit + simulation.expectedMetrics.cogs)}`,
  );
}

function printDiffTable(rows) {
  const headers = ['Metric', 'Legacy MySQL', 'Worker', 'Delta', 'Status'];
  const data = rows.map((row) => [
    row.metric,
    formatMoney(row.mysqlValue),
    formatMoney(row.workerValue),
    formatMoney(row.delta),
    row.status,
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...data.map((row) => row[index].length)),
  );

  const divider = widths.map((width) => '-'.repeat(width)).join('  ');
  const headerLine = headers
    .map((header, index) => padRight(header, widths[index]))
    .join('  ');

  console.log('\n' + headerLine);
  console.log(divider);

  for (const row of data) {
    console.log(
      row
        .map((cell, index) =>
          index === 0 || index === row.length - 1
            ? padRight(cell, widths[index])
            : padLeft(cell, widths[index]),
        )
        .join('  '),
    );
  }
}

async function d1Batch(d1Config, statements) {
  if (statements.length === 0) {
    return [];
  }

  const response = await fetch(d1Url(d1Config, 'query'), {
    method: 'POST',
    headers: d1Headers(d1Config),
    body: JSON.stringify({ batch: statements }),
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok || payload?.success === false) {
    throw new Error(`D1 batch failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload.result || [];
}

async function d1Query(d1Config, sql, params = []) {
  const response = await fetch(d1Url(d1Config, 'query'), {
    method: 'POST',
    headers: d1Headers(d1Config),
    body: JSON.stringify({ sql, params }),
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok || payload?.success === false) {
    throw new Error(`D1 query failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload.result || [];
}

function d1Url(d1Config, endpoint) {
  return `https://api.cloudflare.com/client/v4/accounts/${d1Config.accountId}/d1/database/${d1Config.databaseId}/${endpoint}`;
}

function d1Headers(d1Config) {
  return {
    Authorization: `Bearer ${d1Config.apiToken}`,
    'Content-Type': 'application/json',
  };
}

function getLastInsertId(d1Result) {
  if (Array.isArray(d1Result)) {
    return Number(d1Result[0]?.meta?.last_row_id ?? 0);
  }

  return Number(d1Result?.[0]?.meta?.last_row_id ?? d1Result?.meta?.last_row_id ?? 0);
}

async function runMySqlQuery(mysqlClient, sql, params = []) {
  const rendered = renderSqlWithParams(sql, params);
  return runMySqlScript(mysqlClient, rendered);
}

async function runMySqlScript(mysqlClient, sql) {
  const args = [
    '--host',
    mysqlClient.host,
    '--port',
    String(mysqlClient.port),
    '--user',
    mysqlClient.user,
    '--database',
    mysqlClient.database,
    '--protocol=TCP',
    '--batch',
    '--raw',
    '--xml',
    '--default-character-set=utf8mb4',
  ];

  const result = await spawnProcess(mysqlClient.clientBin, args, {
    env: {
      ...process.env,
      MYSQL_PWD: mysqlClient.password,
    },
    stdin: `${sql}\n`,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `mysql exited with code ${result.exitCode}: ${result.stderr || result.stdout || 'unknown error'}`,
    );
  }

  return parseMySqlXml(result.stdout);
}

function parseMySqlXml(xml) {
  const resultSets = [];
  const resultSetRegex = /<resultset\b([^>]*)>([\s\S]*?)<\/resultset>/g;
  let match = null;

  while ((match = resultSetRegex.exec(xml)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    const statementMatch = attrs.match(/\bstatement="([^"]*)"/);
    const statement = statementMatch ? decodeXml(statementMatch[1]) : '';
    const rows = [];
    const rowRegex = /<row>([\s\S]*?)<\/row>/g;
    let rowMatch = null;

    while ((rowMatch = rowRegex.exec(body)) !== null) {
      const rowBody = rowMatch[1] || '';
      const row = {};
      const fieldRegex =
        /<field\b([^>]*?)name="([^"]+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/field>)/g;
      let fieldMatch = null;

      while ((fieldMatch = fieldRegex.exec(rowBody)) !== null) {
        const leftAttrs = fieldMatch[1] || '';
        const name = decodeXml(fieldMatch[2]);
        const rightAttrs = fieldMatch[3] || '';
        const rawValue = fieldMatch[4];
        const attrsText = `${leftAttrs} ${rightAttrs}`;
        const isNil = /\bxsi:nil="true"/.test(attrsText);
        row[name] = isNil ? null : decodeXml(rawValue ?? '');
      }

      rows.push(row);
    }

    resultSets.push({ statement, rows });
  }

  return resultSets;
}

function extractProcedureResultSets(resultSets) {
  const extracted = [];
  let inside = false;

  for (const resultSet of resultSets) {
    const marker = resultSet.rows[0]?.__marker__;

    if (marker === '__PROC_START__') {
      inside = true;
      continue;
    }

    if (marker === '__PROC_END__') {
      break;
    }

    if (inside) {
      extracted.push(resultSet);
    }
  }

  return extracted;
}

function firstResultSet(resultSets) {
  return resultSets[0]?.rows || [];
}

async function startSshTunnel({ ssh, localPort }) {
  let identityFile = ssh.identityFile;
  let tempKeyPath = null;

  if (!identityFile && ssh.privateKey) {
    tempKeyPath = path.join(os.tmpdir(), `validate-costing-key-${randomUUID()}.pem`);
    await fs.writeFile(tempKeyPath, normalizePrivateKey(ssh.privateKey), {
      mode: 0o600,
    });
    identityFile = tempKeyPath;
  }

  const args = [
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'StrictHostKeyChecking=no',
    '-N',
    '-L',
    `${localPort}:${ssh.destHost}:${ssh.destPort}`,
  ];

  if (identityFile) {
    args.push('-i', identityFile);
  }

  args.push('-p', String(ssh.port), `${ssh.user}@${ssh.host}`);

  const child = spawn('ssh', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const stderrChunks = [];
  child.stderr.on('data', (chunk) => {
    stderrChunks.push(chunk.toString());
  });

  await waitForPort('127.0.0.1', localPort, child, stderrChunks);

  logVerbose('SSH tunnel ready', {
    host: ssh.host,
    port: ssh.port,
    localPort,
    destHost: ssh.destHost,
    destPort: ssh.destPort,
  });

  return {
    process: child,
    tempKeyPath,
  };
}

async function waitForPort(host, port, childProcess, stderrChunks) {
  const timeoutAt = Date.now() + 15000;

  while (Date.now() < timeoutAt) {
    if (childProcess.exitCode != null) {
      throw new Error(`ssh tunnel exited early: ${stderrChunks.join('')}`);
    }

    const ready = await canConnect(host, port);
    if (ready) {
      return;
    }

    await sleep(150);
  }

  throw new Error(`Timed out waiting for SSH tunnel on ${host}:${port}: ${stderrChunks.join('')}`);
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const finish = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

function spawnProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }

    child.stdin.end();
  });
}

async function stopProcess(child) {
  if (!child || child.exitCode != null) {
    return;
  }

  child.kill();
  await new Promise((resolve) => {
    child.once('close', resolve);
    setTimeout(resolve, 1000);
  });
}

function buildInsertStatement(tableName, availableColumns, values, options = {}) {
  const rawColumns = options.rawColumns || new Set();
  const entries = Object.entries(values).filter(([column, value]) => {
    return availableColumns.has(column) && value !== undefined;
  });

  if (entries.length === 0) {
    return `SELECT 1;`;
  }

  const columns = entries.map(([column]) => quoteIdent(column)).join(', ');
  const renderedValues = entries
    .map(([column, value]) => (rawColumns.has(column) && typeof value === 'string' ? value : sqlLiteral(value)))
    .join(', ');

  return `INSERT INTO ${quoteIdent(tableName)} (${columns}) VALUES (${renderedValues});`;
}

function createStockSnapshot(tenantId, item, state) {
  return {
    tenant_id: tenantId,
    item_code: item.itemCode,
    item_name: state.itemName,
    barcode: state.barcode,
    category: state.category,
    unit: state.unit,
    location_code: item.locationCode,
    quantity_on_hand: roundQuantity(state.quantity),
    cost_price: roundCost(state.lastCostPrice),
    avg_cost: roundCost(state.avgCost),
    selling_price: roundCurrency(state.sellingPrice),
  };
}

function getOrCreateState(stateMap, purchase) {
  const key = stockKey(purchase.itemCode, purchase.locationCode);
  const existing = stateMap.get(key);

  if (existing) {
    return existing;
  }

  const initial = {
    itemCode: purchase.itemCode,
    locationCode: purchase.locationCode,
    itemName: purchase.itemName,
    barcode: purchase.barcode,
    category: purchase.category,
    unit: purchase.unit,
    quantity: 0,
    avgCost: 0,
    lastCostPrice: 0,
    sellingPrice: purchase.sellingPrice,
    layers: [],
  };

  stateMap.set(key, initial);
  return initial;
}

function hasTable(schemaInfo, tableName) {
  return Boolean(schemaInfo[tableName]);
}

function getColumns(schemaInfo, tableName) {
  return schemaInfo[tableName] || new Set();
}

function hasColumn(schemaInfo, tableName, columnName) {
  return getColumns(schemaInfo, tableName).has(columnName);
}

function formatMetricObject(metrics) {
  return JSON.stringify(
    {
      cogs: formatMoney(metrics.cogs),
      grossProfit: formatMoney(metrics.grossProfit),
      inventoryValue: formatMoney(metrics.inventoryValue),
    },
    null,
    2,
  );
}

function renderSqlWithParams(sql, params) {
  let index = 0;
  return sql.replace(/\?/g, () => sqlLiteral(params[index++]));
}

function quoteIdent(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function sqlLiteral(value) {
  if (value == null) {
    return 'NULL';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function stockKey(itemCode, locationCode) {
  return `${itemCode}::${locationCode}`;
}

function sequenceSortKey(dateValue, index, kind) {
  const kindWeight = kind === 'purchase' ? '0' : '1';
  return `${new Date(dateValue).toISOString()}::${kindWeight}::${String(index).padStart(4, '0')}`;
}

function normalizeCostingMethod(value) {
  const method = String(value || 'FIFO').trim().toUpperCase();
  if (method !== 'FIFO' && method !== 'AVG') {
    throw new Error(`Unsupported costing method: ${value}`);
  }
  return method;
}

function coerceNumber(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(numeric) ? numeric : NaN;
  }

  return Number(value);
}

function getPathValue(input, pathExpression) {
  const parts = String(pathExpression)
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  let current = input;

  for (const part of parts) {
    if (current == null) {
      return undefined;
    }

    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[Number(part)];
      continue;
    }

    current = current[part];
  }

  return current;
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override ?? base;
  }

  if (base && typeof base === 'object' && override && typeof override === 'object') {
    const output = { ...base };
    for (const [key, value] of Object.entries(override)) {
      output[key] = deepMerge(base[key], value);
    }
    return output;
  }

  return override ?? base;
}

function safeJsonParse(value, fallback, label = 'JSON') {
  if (value == null || value === '') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${error.message}`);
  }
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function sanitizeVariableName(value) {
  return String(value).replace(/[^a-zA-Z0-9_]/g, '_');
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function normalizePrivateKey(value) {
  return String(value).replace(/\\n/g, '\n');
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, '');
}

function makeAbsoluteUrl(baseUrl, maybePath) {
  if (/^https?:\/\//i.test(maybePath)) {
    return maybePath;
  }

  return `${trimTrailingSlash(baseUrl)}/${String(maybePath).replace(/^\/+/, '')}`;
}

function requireEnv(names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundQuantity(value) {
  return Number(Number(value ?? 0).toFixed(4));
}

function roundCost(value) {
  return Number(Number(value ?? 0).toFixed(6));
}

function roundCurrency(value) {
  return Number(Number(value ?? 0).toFixed(2));
}

function formatMoney(value) {
  return roundCurrency(value).toFixed(2);
}

function nowIso() {
  return new Date().toISOString();
}

function padRight(value, width) {
  return String(value).padEnd(width, ' ');
}

function padLeft(value, width) {
  return String(value).padStart(width, ' ');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function logVerbose(message, value) {
  if (!VERBOSE) {
    return;
  }

  if (value === undefined) {
    console.log(`[verbose] ${message}`);
    return;
  }

  console.log(
    `[verbose] ${message}: ${
      typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    }`,
  );
}

main().catch((error) => {
  console.error(`\nValidation failed: ${error.message}`);
  if (VERBOSE && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
