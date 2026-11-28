export type NodeEnvironment = 'development' | 'test' | 'staging' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  bodyLimitBytes: number;
  externalIntegrationsEnabled: boolean;
  databaseUrl?: string;
  databasePoolMax: number;
  databaseConnectionTimeoutMs: number;
  valkeyUrl?: string;
  jwtSigningKey?: string;
  mfaEnabled: boolean;
  eventQueueName?: string;
  attachmentDir?: string;
  printFontPath?: string;
  printSandboxMode: boolean;
  attachmentRetentionDays: number;
  rateLimitEnabled: boolean;
  rateLimitWindowSeconds: number;
  rateLimitMax: number;
  loginRateLimitMax: number;
  gracefulShutdownTimeoutMs: number;
}

function parsePositiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value)) throw new Error('Invalid numeric configuration');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error('Configuration value is outside its allowed range');
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'staging', 'production'].includes(nodeEnv)) {
    throw new Error('Unsupported NODE_ENV');
  }

  const config: AppConfig = {
    nodeEnv: nodeEnv as NodeEnvironment,
    port: parsePositiveInteger(env.PORT, 3100, 65_535),
    bodyLimitBytes: parsePositiveInteger(env.BODY_LIMIT_BYTES, 1_048_576, 10_485_760),
    externalIntegrationsEnabled: env.EXTERNAL_INTEGRATIONS_ENABLED === 'true',
    databasePoolMax: parsePositiveInteger(env.DATABASE_POOL_MAX, 20, 50),
    databaseConnectionTimeoutMs: parsePositiveInteger(env.DATABASE_CONNECTION_TIMEOUT_MS, 10000, 30000),
    printSandboxMode: env.PRINT_SANDBOX_MODE === 'true'
      || (env.STRICT_RUNTIME_MODE === 'native'
        && env.NODE_ENV === 'production'
        && env.PRINT_SANDBOX_MODE !== 'false'),
    mfaEnabled: env.MFA_ENABLED !== 'false',
    attachmentRetentionDays: parsePositiveInteger(env.ATTACHMENT_RETENTION_DAYS, 3650, 36500),
    rateLimitEnabled: env.RATE_LIMIT_ENABLED !== 'false',
    rateLimitWindowSeconds: parsePositiveInteger(env.RATE_LIMIT_WINDOW_SECONDS, 60, 3600),
    rateLimitMax: parsePositiveInteger(env.RATE_LIMIT_MAX, 300, 100000),
    loginRateLimitMax: parsePositiveInteger(env.LOGIN_RATE_LIMIT_MAX, 20, 1000),
    gracefulShutdownTimeoutMs: parsePositiveInteger(env.GRACEFUL_SHUTDOWN_TIMEOUT_MS, 10000, 60000),
  };
  if (env.DATABASE_URL) config.databaseUrl = env.DATABASE_URL;
  if (env.VALKEY_URL) config.valkeyUrl = env.VALKEY_URL;
  if (env.JWT_SIGNING_KEY) config.jwtSigningKey = env.JWT_SIGNING_KEY;
  if (env.EVENT_QUEUE_NAME) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.EVENT_QUEUE_NAME)) throw new Error('Invalid event queue name');
    config.eventQueueName = env.EVENT_QUEUE_NAME;
  }
  if (env.ATTACHMENT_DIR) config.attachmentDir = env.ATTACHMENT_DIR;
  if (env.PRINT_FONT_PATH) config.printFontPath = env.PRINT_FONT_PATH;
  if (config.nodeEnv === 'production' && (!config.databaseUrl || !config.valkeyUrl || !config.jwtSigningKey || Buffer.byteLength(config.jwtSigningKey) < 32)) throw new Error('Production requires DATABASE_URL, VALKEY_URL and a strong JWT_SIGNING_KEY');
  return config;
}
