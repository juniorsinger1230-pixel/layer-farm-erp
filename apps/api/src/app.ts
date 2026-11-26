import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { Hono } from 'hono';
import type { AppConfig } from './config.js';
import { SERVICE_VERSION } from '../../../packages/shared/src/contracts.js';
import type { DependencyStatus, ErrorCode, ErrorEnvelope, HealthResponse, Role } from '../../../packages/shared/src/contracts.js';
import { isSafeRequestId, readJsonObject } from '../../../packages/shared/src/secure-json.js';
import { redactLogValue } from '../../../packages/shared/src/redaction.js';
import { ServiceMetrics } from '../../../packages/shared/src/metrics.js';
import type { AuthService} from '../../../packages/security/src/auth.js';
import { type AuthenticatedPrincipal } from '../../../packages/security/src/auth.js';
import { projectFields, ROLE_PERMISSIONS, assertCompanyScope } from '../../../packages/security/src/rbac.js';
import { DomainService } from '../../../packages/domain/src/service.js';
import { ProductionService } from '../../../packages/domain/src/production.js';
import { InventoryService } from '../../../packages/domain/src/inventory.js';
import { ProcurementService } from '../../../packages/domain/src/procurement.js';
import { SalesService } from '../../../packages/domain/src/sales.js';
import { FinanceService } from '../../../packages/domain/src/finance.js';
import { FlockCostService } from '../../../packages/domain/src/flock-cost.js';
import { PrintService, type PrinterAdapter } from '../../../packages/integrations/src/print.js';
import type { RateLimiter } from '../../../packages/integrations/src/rate-limiter.js';
import { LocalAttachmentStore } from '../../../packages/integrations/src/attachments.js';
import { resources } from '../../../packages/domain/src/generated/resources.js';
import { resourceRoutePolicyByPath } from '../../../packages/domain/src/generated/resource-route-policy.js';
import { ContractProcessService, contractProcessSpecs } from '../../../packages/domain/src/contract-process.js';
import { AppError, internalError, validationError } from '../../../packages/shared/src/errors.js';

export type DependencyProbe = () => Promise<void>;

export interface DependencyProbes {
  database?: DependencyProbe;
  valkey?: DependencyProbe;
}

export interface AppOptions {
  config: AppConfig;
  probes?: DependencyProbes;
  auth?: AuthService;
  database?: Pool;
  printerAdapters?: Map<string, PrinterAdapter>;
  rateLimiter?: RateLimiter;
  attachmentStore?: LocalAttachmentStore;
  printFontPath?: string;
  queueStatus?: () => Promise<unknown>;
  deadLetters?: { list: (limit: number) => Promise<unknown>; replay: (jobId: string) => Promise<void> };
}

type AppEnv = { Variables: { requestId: string; auth: AuthenticatedPrincipal } };

function errorBody(requestId: string, code: ErrorCode, message: string): ErrorEnvelope {
  return { error: { code, message, requestId } };
}

async function checkDependency(configured: boolean, probe?: DependencyProbe): Promise<'up' | 'down' | 'not_configured'> {
  if (!configured) return 'not_configured';
  if (!probe) return 'down';
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Dependency probe timeout')), 2000); }),
    ]);
    return 'up';
  } catch {
    // 探针异常细节只进入受控服务日志，不返回到健康检查响应。
    return 'down';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createApp(options: AppOptions) {
  const app = new Hono<AppEnv>();
  const probes = options.probes ?? {};
  const metrics = new ServiceMetrics();

  app.use('*', async (c, next) => {
    const startedAt = performance.now();
    const incoming = c.req.header('x-request-id');
    const requestId = isSafeRequestId(incoming) ? incoming : randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    try {
      await next();
    } finally {
      const route = c.req.routePath === '/' ? c.req.path.replace(/\/\d+(?=\/|$)/g, '/:id') : c.req.routePath;
      metrics.observeRequest(c.req.method, route, c.res.status, (performance.now() - startedAt) / 1000);
      const event = redactLogValue({
        event: 'http_request',
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
      });
      console.log(JSON.stringify(event));
    }
  });

  app.use('/api/*', async (c, next) => {
    const contentLength = c.req.header('content-length');
    if (contentLength !== undefined && /^\d+$/.test(contentLength) && Number(contentLength) > options.config.bodyLimitBytes) {
      return c.json(errorBody(c.get('requestId'), 'PAYLOAD_TOO_LARGE', '请求内容超过允许大小'), 413);
    }
    if (options.config.rateLimitEnabled && options.rateLimiter) {
      const forwardedFor = c.req.header('x-forwarded-for');
      const ip = (forwardedFor?.split(',')[0]?.trim() || 'unknown').replaceAll(':', '_');
      const isLogin = c.req.path === '/api/v1/auth/login';
      const limit = isLogin ? options.config.loginRateLimitMax : options.config.rateLimitMax;
      try {
        const decision = await options.rateLimiter.check(`${isLogin ? 'login' : 'api'}:${ip}`, limit, options.config.rateLimitWindowSeconds);
        c.header('X-RateLimit-Limit', String(decision.limit));
        c.header('X-RateLimit-Remaining', String(decision.remaining));
        c.header('X-RateLimit-Reset', String(decision.resetAt));
        if (!decision.allowed) {
          c.header('Retry-After', String(Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000))));
          return c.json(errorBody(c.get('requestId'), 'RATE_LIMITED', '请求过于频繁，请稍后再试'), 429);
        }
      } catch (error) {
        console.error(JSON.stringify(redactLogValue({ event: 'rate_limit_failed', requestId: c.get('requestId'), message: error instanceof Error ? error.message : 'unknown' })));
        return c.json(errorBody(c.get('requestId'), 'SERVICE_UNAVAILABLE', '限流服务暂时不可用'), 503);
      }
    }
    await next();
  });

  app.get('/metrics', (c) => {
    c.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return c.body(metrics.render('layer-farm-erp-api'));
  });

  app.get('/health/live', (c) => {
    const body: HealthResponse = {
      status: 'ok', service: 'layer-farm-erp-api', version: SERVICE_VERSION, requestId: c.get('requestId'),
    };
    return c.json(body);
  });

  app.get('/health/ready', async (c) => {
    const dependencies: DependencyStatus = {
      database: await checkDependency(options.config.databaseUrl !== undefined, probes.database),
      valkey: await checkDependency(options.config.valkeyUrl !== undefined, probes.valkey),
    };
    const ready = dependencies.database === 'up' && dependencies.valkey === 'up';
    const body: HealthResponse = {
      status: ready ? 'ok' : 'unavailable', service: 'layer-farm-erp-api',
      version: SERVICE_VERSION, requestId: c.get('requestId'), dependencies,
    };
    if (!ready) return c.json(body, 503);
    return c.json(body);
  });

  app.get('/health/queue', async (c) => {
    if (!options.queueStatus) return c.json(errorBody(c.get('requestId'), 'SERVICE_UNAVAILABLE', '事件队列尚未配置'), 503);
    return c.json({ status: 'ok', queues: await options.queueStatus(), requestId: c.get('requestId') });
  });

  app.post('/api/v1/auth/login', async (c) => {
    if (options.auth === undefined) throw new AppError(503, 'SERVICE_UNAVAILABLE', '认证服务尚未配置');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const allowed = new Set(['account', 'password', 'companyCode', 'mfaCode']);
    if (Object.keys(body).some((key) => !allowed.has(key)) || typeof body.account !== 'string' || typeof body.password !== 'string' || typeof body.companyCode !== 'string' || (body.mfaCode !== undefined && typeof body.mfaCode !== 'string')) throw validationError();
    const tokens = await options.auth.login(body.account, body.password, body.companyCode, body.mfaCode);
    return c.json({ data: tokens });
  });

  app.post('/api/v1/auth/refresh', async (c) => {
    if (options.auth === undefined) throw new AppError(503, 'SERVICE_UNAVAILABLE', '认证服务尚未配置');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    if (Object.keys(body).length !== 1 || typeof body.refreshToken !== 'string') throw validationError();
    return c.json({ data: await options.auth.refresh(body.refreshToken) });
  });

  app.use('/api/v1/*', async (c, next) => {
    if (options.auth === undefined) throw new AppError(503, 'SERVICE_UNAVAILABLE', '认证服务尚未配置');
    const authenticated = await options.auth.authenticate(c.req.header('authorization'));
    c.set('auth', authenticated);
    const requestedCompany = c.req.header('x-company-code');
    const effectiveCompany = requestedCompany ?? authenticated.principal.companyCode;
    if (requestedCompany !== undefined) {
      assertCompanyScope(authenticated.access, requestedCompany);
    }
    const company = await options.database!.query<{ id: string }>(
      'SELECT id FROM app.company WHERE company_code=$1',
      [effectiveCompany],
    );
    if (company.rowCount === 1) {
      authenticated.principal.companyId = Number(company.rows[0]!.id);
    } else if (
      !(c.req.method === 'POST' && c.req.path === '/api/v1/org/organizations')
      && !(c.req.method === 'GET' && c.req.path === '/api/v1/org/organizations')
      && !(c.req.method === 'GET' && c.req.path === '/api/v1/auth/me')
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', '公司不存在或已停用');
    }
    await next();
  });

  app.get('/api/v1/auth/me', (c) => {
    const authenticated = c.get('auth');
    const roles = authenticated.principal.roles.map((assignment) => assignment.role);
    return c.json({ data: projectFields({
      employeeId: authenticated.principal.employeeId,
      employeeNo: authenticated.principal.employeeNo,
      companyCode: authenticated.principal.companyCode,
      roles,
      permissions: [...authenticated.access.permissions].sort(),
      companyScope: authenticated.access.companyCodes === '*' ? '*' : [...authenticated.access.companyCodes].sort(),
      houseScope: [...authenticated.access.houseIds].sort((a, b) => a - b),
      warehouseScope: [...authenticated.access.warehouseIds].sort((a, b) => a - b),
    }, roles) });
  });

  app.post('/api/v1/auth/logout', async (c) => {
    await options.auth!.logout(c.req.header('authorization'));
    return c.body(null, 204);
  });

  app.get('/api/v1/org/role-permissions', (c) => {
    const authenticated = c.get('auth');
    options.auth!.authorize(authenticated, 'rbac:manage');
    return c.json({ data: Object.fromEntries(Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => [role, [...permissions].sort()])) });
  });

  const domainFor = (c: { get: (key: 'auth') => AuthenticatedPrincipal; req: { header: (name: string) => string | undefined } }, table: string): { service: DomainService; production: ProductionService; inventory: InventoryService; procurement: ProcurementService; sales: SalesService; finance: FinanceService; flockCost: FlockCostService; print: PrintService; contractProcess: ContractProcessService; roles: Role[] } => {
    if (options.database === undefined) throw new AppError(503, 'SERVICE_UNAVAILABLE', '业务数据库尚未配置');
    void table;
    const authenticated = c.get('auth');
    const companyCode = c.req.header('x-company-code') ?? c.req.header('x-company') ?? authenticated.principal.companyCode;
    assertCompanyScope(authenticated.access, companyCode);
    const roles = authenticated.principal.roles.map((assignment) => assignment.role);
    const context = {
      actorId: authenticated.principal.employeeNo, employeeId: authenticated.principal.employeeId,
      companyCode, companyId: authenticated.principal.companyId,
      houseIds: [...authenticated.access.houseIds],
      warehouseIds: [...authenticated.access.warehouseIds],
      selfOnly: authenticated.access.selfOnly,
      taskOnly: authenticated.access.taskOnly,
    };
    return {
      service: new DomainService(options.database, context),
      production: new ProductionService(options.database, context),
      inventory: new InventoryService(options.database, context),
      procurement: new ProcurementService(options.database, context),
      sales: new SalesService(options.database, context),
      finance: new FinanceService(options.database, context),
      flockCost: new FlockCostService(options.database, context),
      print: new PrintService(options.database, context, options.attachmentStore ?? new LocalAttachmentStore(resolve(process.cwd(), 'data', 'attachments')), options.printerAdapters ?? new Map<string, PrinterAdapter>(), options.printFontPath, options.config.attachmentRetentionDays),
      contractProcess: new ContractProcessService(options.database, context, options.attachmentStore, options.printerAdapters, options.printFontPath),
      roles,
    };
  };

  const contractPermission = (path: string, kind: 'read' | 'create' | 'update' | 'action', actionName?: string): string => {
    const segment = path.split('/')[3];
    const moduleName = ({
      org: 'master', farm: 'production', vet: 'vet', proc: 'purchase', sales: 'sales',
      log: 'delivery', fin: 'finance', eqp: 'equipment', rpt: 'report', print: 'print',
      trace: 'report', plat: 'master',
    } as Record<string, string>)[segment ?? ''];
    if (kind === 'read') return `${moduleName}:read`;
    if (kind === 'create') return `${moduleName}:create`;
    if (kind === 'update') return `${moduleName}:update`;
    if (['approve', 'publish', 'accept', 'settle', 'archive'].includes(actionName ?? '')) return `${moduleName}:approve`;
    return `${moduleName}:update`;
  };

  app.post('/api/v1/farm/feeding-management/:id/issue', async (c) => {
    options.auth!.authorize(c.get('auth'), 'production:create');
    const { production, roles } = domainFor(c, 'feeding_record');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await production.issueFeed(c.req.param('id'), body, key), roles) }, 201);
  });
  app.post('/api/v1/farm/flock-batches/:id/cost-postings', async (c) => {
    options.auth!.authorize(c.get('auth'), 'production:create');
    const { flockCost, roles } = domainFor(c, 'farm_batch');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await flockCost.post(c.req.param('id'), body, key), roles) }, 201);
  });
  app.get('/api/v1/farm/flock-batches/:id/cost', async (c) => {
    options.auth!.authorize(c.get('auth'), 'production:read');
    const { flockCost, roles } = domainFor(c, 'farm_batch');
    return c.json({ data: projectFields(await flockCost.get(c.req.param('id')), roles) });
  });

  app.post('/api/v1/farm/flock-batches/:id/actions', async (c) => {
    options.auth!.authorize(c.get('auth'), 'production:update');
    const { production, roles } = domainFor(c, 'farm_batch');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    if (body.action !== 'place') throw validationError();
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await production.placeFlock(c.req.param('id'), body, key), roles) });
  });

  app.get('/api/v1/farm/flock-batches/:id/positions', async (c) => {
    options.auth!.authorize(c.get('auth'), 'production:read');
    const { production, roles } = domainFor(c, 'farm_batch');
    return c.json({ data: projectFields(await production.flockPosition(c.req.param('id')), roles) });
  });

  app.get('/api/v1/farm/egg-collection-grading', async (c) => {
    options.auth!.authorize(c.get('auth'), 'production:read');
    const { production, roles } = domainFor(c, 'egg_collection');
    return c.json({ data: projectFields(await production.listEggCollections(c.req.query('batchId')), roles) });
  });

  app.post('/api/v1/farm/egg-collection-grading', async (c) => {
    options.auth!.authorize(c.get('auth'), 'production:create');
    const { production, roles } = domainFor(c, 'egg_collection');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await production.collectEggs(body, key), roles) }, 201);
  });

  app.get('/api/v1/print/print-templates/:id/design', async (c) => {
    options.auth!.authorize(c.get('auth'), 'print:read');
    const { print } = domainFor(c, 'print_template');
    return c.json({ data: await print.getLatestDesign(c.req.param('id')) });
  });
  app.post('/api/v1/print/print-templates/:id/design', async (c) => {
    options.auth!.authorize(c.get('auth'), 'print:create');
    const { print } = domainFor(c, 'print_template');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: await print.saveDesign(c.req.param('id'), body, key) }, 201);
  });
  app.post('/api/v1/print/print-templates/:id/design/:designId/publish', async (c) => {
    options.auth!.authorize(c.get('auth'), 'print:update');
    const { print } = domainFor(c, 'print_template');
    return c.json({ data: await print.publishDesign(c.req.param('id'), c.req.param('designId')) });
  });
  app.post('/api/v1/print/design-preview', async (c) => {
    options.auth!.authorize(c.get('auth'), 'print:read');
    const { print } = domainFor(c, 'print_template');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const preview = await print.previewDesign(body);
    return c.body(Buffer.from(preview.content), 200, { 'content-type': preview.mime });
  });

  app.post('/api/v1/print/print-job/submit', async (c) => {
    options.auth!.authorize(c.get('auth'), 'print:create');
    const { print, roles } = domainFor(c, 'print_job');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await print.submit(body, key), roles) }, 201);
  });
  app.post('/api/v1/print/print-job/:id/dispatch', async (c) => {
    options.auth!.authorize(c.get('auth'), 'print:update');
    const { print, roles } = domainFor(c, 'print_job');
    return c.json({ data: projectFields(await print.dispatch(c.req.param('id')), roles) });
  });
  app.post('/api/v1/plat/attachments-import-export/destroy-expired', async (c) => {
    options.auth!.authorize(c.get('auth'), 'platform:delete');
    const { print } = domainFor(c, 'attachment');
    return c.json({ data: await print.destroyExpired() });
  });
  app.post('/api/v1/plat/attachments-import-export/upload', async (c) => {
    options.auth!.authorize(c.get('auth'), 'platform:create');
    const { print, roles } = domainFor(c, 'attachment');
    const body = await c.req.parseBody(); const file = body.file;
    if (!(file instanceof File)) throw validationError();
    if (file.size > options.config.bodyLimitBytes) throw new AppError(413, 'PAYLOAD_TOO_LARGE', '附件超过大小限制');
    return c.json({ data: projectFields(await print.upload(new Uint8Array(await file.arrayBuffer()), file.name, file.type, typeof body.ownerRef === 'string' ? body.ownerRef : ''), roles) }, 201);
  });

  app.post('/api/v1/fin/journal-entries', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:create');
    const { finance, roles } = domainFor(c, 'journal_entry');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await finance.postJournal(body, key), roles) }, 201);
  });
  app.post('/api/v1/fin/receipt-settlements', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:update');
    const { finance, roles } = domainFor(c, 'receipt_record');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await finance.receivePayment(body, key), roles) }, 201);
  });
  app.post('/api/v1/fin/payment-executions', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:update');
    const { finance, roles } = domainFor(c, 'payment_record');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await finance.executePayment(body, key), roles) }, 201);
  });
  app.post('/api/v1/fin/tax-rates', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:update');
    const { finance, roles } = domainFor(c, 'tax_rate');
    return c.json({ data: projectFields(await finance.setTaxRate(await readJsonObject(c.req.raw, options.config.bodyLimitBytes)), roles) }, 201);
  });
  app.post('/api/v1/fin/tax-transactions', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:update');
    const { finance, roles } = domainFor(c, 'tax_transaction');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await finance.registerTax(body, key), roles) }, 201);
  });
  app.get('/api/v1/fin/operating-dashboard', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:read');
    const { finance, roles } = domainFor(c, 'journal_entry');
    return c.json({ data: projectFields(await finance.dashboard(c.req.query('from'), c.req.query('to')), roles) });
  });
  app.get('/api/v1/fin/tax-report', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:read');
    const { finance, roles } = domainFor(c, 'tax_transaction');
    return c.json({ data: projectFields(await finance.taxReport(c.req.query('from'), c.req.query('to'), c.req.query('birForm')), roles) });
  });
  app.get('/api/v1/fin/periods', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:read');
    const { finance, roles } = domainFor(c, 'accounting_period');
    return c.json({ data: projectFields(await finance.listPeriods(c.req.query('status')), roles) });
  });
  app.post('/api/v1/fin/periods', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:approve');
    const { finance, roles } = domainFor(c, 'accounting_period');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await finance.openPeriod(body, key), roles) }, 201);
  });
  app.post('/api/v1/fin/periods/:id/close', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:approve');
    const { finance, roles } = domainFor(c, 'accounting_period');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await finance.closePeriod(c.req.param('id'), body, key), roles) });
  });
  app.post('/api/v1/fin/periods/:id/reopen', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:approve');
    const { finance, roles } = domainFor(c, 'accounting_period');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await finance.reopenPeriod(c.req.param('id'), body, key), roles) });
  });
  app.get('/api/v1/fin/ar-aging', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:read');
    const { finance, roles } = domainFor(c, 'receivable');
    return c.json({ data: projectFields(await finance.arAging(c.req.query('asOf')), roles) });
  });
  app.get('/api/v1/fin/ap-aging', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:read');
    const { finance, roles } = domainFor(c, 'payable');
    return c.json({ data: projectFields(await finance.apAging(c.req.query('asOf')), roles) });
  });
  app.get('/api/v1/fin/trial-balance', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:read');
    const { finance, roles } = domainFor(c, 'journal_line');
    return c.json({ data: projectFields(await finance.trialBalance(c.req.query('from'), c.req.query('to')), roles) });
  });
  app.get('/api/v1/fin/financial-statements', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:read');
    const { finance, roles } = domainFor(c, 'journal_line');
    return c.json({ data: projectFields(await finance.financialStatements(c.req.query('asOf')), roles) });
  });
  app.get('/api/v1/fin/aging-export', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:export');
    const { finance } = domainFor(c, 'journal_line');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="aging.csv"');
    return c.body(await finance.agingCsv(c.req.query('type'), c.req.query('asOf'), c.req.query('locale')));
  });
  app.get('/api/v1/fin/tax-report-export', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:export');
    const { finance } = domainFor(c, 'tax_transaction');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="bir-tax-report.csv"');
    return c.body(await finance.taxReportCsv(c.req.query('from'), c.req.query('to'), c.req.query('birForm'), c.req.query('locale')));
  });
  app.get('/api/v1/fin/financial-statements-export', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:export');
    const { finance } = domainFor(c, 'journal_line');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="financial-statements.csv"');
    return c.body(await finance.financialStatementsCsv(c.req.query('asOf'), c.req.query('locale')));
  });

  app.post('/api/v1/sales/sales-returns', async (c) => {
    options.auth!.authorize(c.get('auth'), 'sales:update');
    const { sales, roles } = domainFor(c, 'sales_return_execution');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await sales.createReturn(body, key), roles) }, 201);
  });

  app.get('/api/v1/sales/delivery-tasks', async (c) => {
    options.auth!.authorize(c.get('auth'), 'sales:read');
    const { sales, roles } = domainFor(c, 'delivery_task');
    return c.json({ data: projectFields(await sales.listDeliveryTasks(), roles) });
  });

  app.post('/api/v1/sales/delivery-tasks/dispatch', async (c) => {
    options.auth!.authorize(c.get('auth'), 'sales:update');
    const { sales, roles } = domainFor(c, 'delivery_task');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await sales.dispatchDeliveryTask(body, key), roles) }, 201);
  });

  app.post('/api/v1/sales/delivery-tasks/:id/events', async (c) => {
    options.auth!.authorize(c.get('auth'), 'sales:update');
    const { sales, roles } = domainFor(c, 'delivery_status_event');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await sales.addDeliveryEvent(c.req.param('id'), body, key), roles) }, 201);
  });

  app.get('/api/v1/sales/customers/:id/statement', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:read');
    const { sales, roles } = domainFor(c, 'receivable');
    return c.json({ data: projectFields(await sales.statement(c.req.param('id')), roles) });
  });

  app.get('/api/v1/sales/discount-approvals', async (c) => {
    options.auth!.authorize(c.get('auth'), 'sales:read');
    const { sales, roles } = domainFor(c, 'sales_discount_approval');
    return c.json({ data: projectFields(await sales.listDiscountApprovals(c.req.query('status')), roles) });
  });

  app.post('/api/v1/sales/sales-orders/:id/discount', async (c) => {
    options.auth!.authorize(c.get('auth'), 'discount:create');
    const { sales, roles } = domainFor(c, 'sales_discount_approval');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await sales.requestDiscount(c.req.param('id'), body, key), roles) }, 201);
  });

  app.post('/api/v1/sales/discount-approvals/:id/actions', async (c) => {
    options.auth!.authorize(c.get('auth'), 'sales:approve');
    const { sales, roles } = domainFor(c, 'sales_discount_approval');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await sales.reviewDiscount(c.req.param('id'), body, key), roles) });
  });

  app.post('/api/v1/proc/supplier-lead-times', async (c) => {
    options.auth!.authorize(c.get('auth'), 'purchase:update');
    const { procurement, roles } = domainFor(c, 'supplier_lead_time');
    return c.json({ data: projectFields(await procurement.setLeadTime(await readJsonObject(c.req.raw, options.config.bodyLimitBytes)), roles) }, 201);
  });

  app.post('/api/v1/proc/mrp-runs', async (c) => {
    options.auth!.authorize(c.get('auth'), 'purchase:update');
    const { procurement, roles } = domainFor(c, 'mrp_run');
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await procurement.calculateMrp(await readJsonObject(c.req.raw, options.config.bodyLimitBytes), key), roles) }, 201);
  });

  app.post('/api/v1/proc/procurement-returns', async (c) => {
    options.auth!.authorize(c.get('auth'), 'purchase:update');
    const { procurement, roles } = domainFor(c, 'procurement_return');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await procurement.returnReceipt(body, key), roles) }, 201);
  });

  app.post('/api/v1/proc/supplier-bindings', async (c) => {
    options.auth!.authorize(c.get('auth'), 'supplier:manage');
    const { procurement, roles } = domainFor(c, 'supplier_account_binding');
    return c.json({ data: projectFields(await procurement.bindSupplier(await readJsonObject(c.req.raw, options.config.bodyLimitBytes)), roles) }, 201);
  });
  app.get('/api/v1/proc/portal/purchase-orders', async (c) => {
    options.auth!.authorize(c.get('auth'), 'purchase:read');
    const { procurement, roles } = domainFor(c, 'purchase_order');
    return c.json({ data: projectFields(await procurement.portalOrders(), roles) });
  });
  app.post('/api/v1/proc/portal/purchase-orders/:id/confirm', async (c) => {
    options.auth!.authorize(c.get('auth'), 'purchase:update');
    const { procurement, roles } = domainFor(c, 'supplier_order_confirmation');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await procurement.confirmPortalOrder(c.req.param('id'), body, key), roles) });
  });
  app.post('/api/v1/proc/portal/advance-shipping-notices', async (c) => {
    options.auth!.authorize(c.get('auth'), 'purchase:update');
    const { procurement, roles } = domainFor(c, 'supplier_asn');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await procurement.createPortalAsn(body, key), roles) }, 201);
  });

  app.post('/api/v1/proc/advance-shipping-notices/:id/receive', async (c) => {
    options.auth!.authorize(c.get('auth'), 'receipt:create');
    const { procurement, roles } = domainFor(c, 'supplier_asn');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await procurement.receivePortalAsn(c.req.param('id'), body, key), roles) }, 201);
  });

  app.post('/api/v1/sales/livestock-sales', async (c) => {
    options.auth!.authorize(c.get('auth'), 'sales:create');
    const { sales, roles } = domainFor(c, 'livestock_sale_execution');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes); const key = c.req.header('idempotency-key');
    if (key === undefined) throw validationError();
    return c.json({ data: projectFields(await sales.createLivestockSale(body, key), roles) }, 201);
  });
  app.get('/api/v1/fin/sales-orders/:id/profit', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:read');
    const { finance, roles } = domainFor(c, 'sales_order');
    return c.json({ data: projectFields(await finance.salesProfit(c.req.param('id')), roles) });
  });
  app.get('/api/v1/fin/sales-orders/:id/profit-export', async (c) => {
    options.auth!.authorize(c.get('auth'), 'finance:export');
    const { finance } = domainFor(c, 'sales_order');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="sales-profit-${c.req.param('id')}.csv"`);
    return c.body(await finance.salesProfitCsv(c.req.param('id'), c.req.query('locale')));
  });

  app.post('/api/v1/inv/uom-conversions', async (c) => {
    options.auth!.authorize(c.get('auth'), 'inventory:update');
    const { inventory, roles } = domainFor(c, 'material_uom_conversion');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    return c.json({ data: projectFields(await inventory.configureUom(body), roles) }, 201);
  });

  app.get('/api/v1/inv/batch-trace', async (c) => {
    options.auth!.authorize(c.get('auth'), 'inventory:read');
    const { inventory, roles } = domainFor(c, 'inventory_ledger');
    return c.json({ data: projectFields(await inventory.trace(c.req.query('materialId'), c.req.query('batchNo')), roles) });
  });

  app.get('/api/v1/inv/stock-positions', async (c) => {
    options.auth!.authorize(c.get('auth'), 'inventory:read');
    const { inventory, roles } = domainFor(c, 'inventory_ledger');
    return c.json({ data: projectFields(await inventory.positions(c.req.query('materialId')), roles) });
  });

  app.post('/api/v1/inv/stock-counts/:id/lines', async (c) => {
    options.auth!.authorize(c.get('auth'), 'inventory:update');
    const { inventory, roles } = domainFor(c, 'stocktake_record');
    const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
    const key = c.req.header('idempotency-key');
    if (key === undefined || !Array.isArray(body.lines)) throw validationError();
    return c.json({ data: projectFields(await inventory.recordStocktakeLines(c.req.param('id'), body.lines, key), roles) });
  });

  app.get('/api/v1/events/dead-letters', async (c) => {
    options.auth!.authorize(c.get('auth'), 'events:manage');
    if (!options.deadLetters) throw new AppError(503, 'SERVICE_UNAVAILABLE', '事件队列未配置');
    const requested = Number(c.req.query('limit') ?? '100');
    const limit = Number.isInteger(requested) && requested > 0 && requested <= 200 ? requested : 100;
    return c.json({ data: await options.deadLetters.list(limit) });
  });
  app.post('/api/v1/events/dead-letters/:jobId/replay', async (c) => {
    options.auth!.authorize(c.get('auth'), 'events:manage');
    if (!options.deadLetters) throw new AppError(503, 'SERVICE_UNAVAILABLE', '事件队列未配置');
    try {
      await options.deadLetters.replay(c.req.param('jobId'));
    } catch (error) {
      if (error instanceof Error && error.message === 'Dead-letter job not found') throw new AppError(404, 'NOT_FOUND', '死信任务不存在');
      throw error;
    }
    return c.json({ data: { jobId: c.req.param('jobId'), status: 'replayed' } });
  });

  for (const processSpec of contractProcessSpecs) {
    if (!processSpec.collectionAlreadyRegistered) {
      app.get(processSpec.path, async (c) => {
        options.auth!.authorize(c.get('auth'), contractPermission(processSpec.path, 'read'));
        const { contractProcess, roles } = domainFor(c, processSpec.table);
        const query = c.req.query();
        const reserved = new Set(['page', 'pageSize']);
        const filters = Object.fromEntries(Object.entries(query).filter(([key]) => !reserved.has(key)));
        const result = await contractProcess.list(processSpec.path, {
          page: query.page, pageSize: query.pageSize, filters,
        });
        return c.json({ data: projectFields(result, roles) });
      });

      if (!processSpec.readOnly) {
        app.post(processSpec.path, async (c) => {
          options.auth!.authorize(c.get('auth'), contractPermission(processSpec.path, 'create'));
          const { contractProcess, roles } = domainFor(c, processSpec.table);
          const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
          const idempotencyKey = c.req.header('idempotency-key');
          if (idempotencyKey === undefined) throw validationError();
          const created = await contractProcess.create(processSpec.path, body, idempotencyKey);
          return c.json({ data: projectFields(created, roles) }, 201);
        });
      }
    }

    app.get(`${processSpec.path}/:id`, async (c) => {
      options.auth!.authorize(c.get('auth'), contractPermission(processSpec.path, 'read'));
      const { contractProcess, roles } = domainFor(c, processSpec.table);
      const result = await contractProcess.get(processSpec.path, c.req.param('id'));
      return c.json({ data: projectFields(result, roles) });
    });

    if (!processSpec.readOnly) {
      app.patch(`${processSpec.path}/:id`, async (c) => {
        options.auth!.authorize(c.get('auth'), contractPermission(processSpec.path, 'update'));
        const { contractProcess, roles } = domainFor(c, processSpec.table);
        const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
        const result = await contractProcess.update(processSpec.path, c.req.param('id'), body);
        return c.json({ data: projectFields(result, roles) });
      });

      app.post(`${processSpec.path}/:id/actions`, async (c) => {
        const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
        const actionName = typeof body.action === 'string' ? body.action : '';
        options.auth!.authorize(c.get('auth'), contractPermission(processSpec.path, 'action', actionName));
        const { contractProcess, roles } = domainFor(c, processSpec.table);
        const idempotencyKey = c.req.header('idempotency-key');
        const result = await contractProcess.action(processSpec.path, c.req.param('id'), body, idempotencyKey);
        return c.json({ data: projectFields(result, roles) });
      });
    }
  }

  for (const resource of resources) {
    const policy = resourceRoutePolicyByPath.get(resource.path);
    if (!policy) continue;
    const allows = (method: string): boolean => policy.allowedMethods.includes(method);

    if (allows('GET')) {
      app.get(resource.path, async (c) => {
        options.auth!.authorize(c.get('auth'), `${resource.permission}:read`);
        const { service, roles } = domainFor(c, resource.table);
        const query = c.req.query();
        const reserved = new Set(['page', 'pageSize', 'orderBy', 'orderDirection']);
        const filters = Object.fromEntries(Object.entries(query).filter(([key]) => !reserved.has(key)));
        const page = Number(query.page ?? 1);
        const pageSize = Number(query.pageSize ?? 50);
        const direction = query.orderDirection?.toUpperCase();
        if (direction !== undefined && direction !== 'ASC' && direction !== 'DESC') throw validationError();
        const result = await service.list(resource.table, {
          page, pageSize, filters,
          ...(query.orderBy === undefined ? {} : { orderBy: query.orderBy }),
          ...(direction === undefined ? {} : { orderDirection: direction }),
        });
        return c.json({ data: projectFields(result, roles) });
      });

      app.get(`${resource.path}/:id`, async (c) => {
        options.auth!.authorize(c.get('auth'), `${resource.permission}:read`);
        const { service, roles } = domainFor(c, resource.table);
        return c.json({ data: projectFields(await service.get(resource.table, c.req.param('id')), roles) });
      });
    }

    if (allows('POST')) {
      app.post(resource.path, async (c) => {
        options.auth!.authorize(c.get('auth'), `${resource.permission}:create`);
        const { service, roles } = domainFor(c, resource.table);
        const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
        const idempotencyKey = c.req.header('idempotency-key');
        if (idempotencyKey === undefined) throw validationError();
        const created = await service.create(resource.table, body, idempotencyKey);
        return c.json({ data: projectFields(created, roles) }, 201);
      });

      app.post(`${resource.path}/:id/actions`, async (c) => {
        const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
        if (typeof body.action !== 'string' || !/^[a-z_]+$/.test(body.action)) throw validationError();
        const conversionAction = resource.table === 'purchase_requisition' && body.action === 'convert_to_purchase_order';
        const actionPermission = conversionAction || ['approve', 'reject', 'accept', 'release'].includes(body.action)
          ? `${resource.permission}:approve`
          : `${resource.permission}:update`;
        options.auth!.authorize(c.get('auth'), actionPermission);
        const { service, inventory, procurement, roles } = domainFor(c, resource.table);
        const key = c.req.header('idempotency-key');
        let updated: unknown;
        if (resource.table === 'goods_receipt' && body.action === 'receive') {
          if (key === undefined) throw validationError();
          updated = await inventory.receive({ ...body, goodsReceiptId: c.req.param('id') }, key);
        } else if (resource.table === 'sales_order' && body.action === 'allocate') {
          if (key === undefined) throw validationError();
          updated = await inventory.reserve(c.req.param('id'), body.lines, key);
        } else if (resource.table === 'sales_order' && body.action === 'ship') {
          if (key === undefined) throw validationError();
          updated = await inventory.issue(c.req.param('id'), key);
        } else if (resource.table === 'sales_order' && body.action === 'release') {
          if (key === undefined) throw validationError();
          updated = await inventory.release(c.req.param('id'), key);
        } else if (resource.table === 'purchase_requisition' && body.action === 'convert_to_purchase_order') {
          if (key === undefined || typeof body.data !== 'object' || body.data === null) throw validationError();
          updated = await procurement.convertRequisition(c.req.param('id'), body.data as Record<string, unknown>, key);
        } else {
          updated = await service.transition(resource.table, c.req.param('id'), body.action, c.req.header('if-match')?.replaceAll('"', ''));
        }
        return c.json({ data: projectFields(updated, roles) });
      });
    }

    if (allows('PATCH')) {
      app.patch(`${resource.path}/:id`, async (c) => {
        options.auth!.authorize(c.get('auth'), `${resource.permission}:update`);
        const { service, roles } = domainFor(c, resource.table);
        const body = await readJsonObject(c.req.raw, options.config.bodyLimitBytes);
        const updated = await service.update(resource.table, c.req.param('id'), body, c.req.header('if-match')?.replaceAll('"', ''));
        return c.json({ data: projectFields(updated, roles) });
      });
    }
  }

  app.notFound((c) => c.json(errorBody(c.get('requestId'), 'NOT_FOUND', '请求资源不存在'), 404));
  app.onError((error, c) => {
    const errorCode = (error as Error & { code?: string }).code;
    const safeError = error instanceof AppError
      ? error
      : errorCode === '23505'
        ? new AppError(409, 'CONFLICT', '业务编号或唯一记录已存在')
        : errorCode === '23514' || errorCode === '22P02' || errorCode === '22003'
          ? validationError()
          : errorCode === '42501' || errorCode === 'AUTH_SCOPE_VIOLATION'
            ? new AppError(403, errorCode === 'AUTH_SCOPE_VIOLATION' ? 'AUTH_SCOPE_VIOLATION' : 'FORBIDDEN', '数据范围不允许该操作')
            : internalError();
    const event = redactLogValue({
      event: 'http_error', requestId: c.get('requestId'), errorName: error.name, errorMessage: error.message, code: safeError.code,
    });
    console.error(JSON.stringify(event));
    return c.json(errorBody(c.get('requestId'), safeError.code, safeError.publicMessage), safeError.status);
  });

  return app;
}
