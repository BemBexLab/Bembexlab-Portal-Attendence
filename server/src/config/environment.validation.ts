type EnvironmentConfig = Record<string, string | undefined>;

import { extractRedisUrl } from './redis-connection';

type RequiredEnvironmentKey = 'DATABASE_URL' | 'PORT';

function readRequired(config: EnvironmentConfig, key: RequiredEnvironmentKey) {
  const value = config[key];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function readPort(config: EnvironmentConfig, key: RequiredEnvironmentKey) {
  const value = Number(readRequired(config, key));

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return value;
}

function readOptionalNonNegativeInteger(
  config: EnvironmentConfig,
  key: string,
  fallback: number,
) {
  const rawValue = config[key];

  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }

  return value;
}

function validateZktecoProtocol(value?: string) {
  if (!value || value.trim().length === 0) {
    return 'auto';
  }

  if (!['auto', 'tcp', 'udp'].includes(value)) {
    throw new Error('ZKTECO_PROTOCOL must be one of auto, tcp, udp');
  }

  return value;
}

function validatePostgresUrl(value: string, key: string) {
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
    throw new Error(
      `${key} must be a PostgreSQL connection string, not a Supabase API URL`,
    );
  }

  if (value.includes('REPLACE_WITH') || value.includes('REGION')) {
    throw new Error(
      `${key} still contains placeholder values from the Supabase template`,
    );
  }

  return value;
}

function validateSupabaseUrl(value: string, key: string) {
  const parsedUrl = new URL(value);

  if (
    parsedUrl.protocol !== 'https:' ||
    !parsedUrl.hostname.endsWith('.supabase.co')
  ) {
    throw new Error(`${key} must be a Supabase https://*.supabase.co URL`);
  }

  return value;
}

function validateOptionalSupabaseUrl(value: string | undefined, key: string) {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return validateSupabaseUrl(value, key);
}

function validateRedis(config: EnvironmentConfig) {
  const redisUrl = config.REDIS_URL;

  if (redisUrl && redisUrl.trim().length > 0) {
    const normalizedUrl = extractRedisUrl(redisUrl);

    if (!normalizedUrl) {
      throw new Error('REDIS_URL must start with redis:// or rediss://');
    }

    const parsedUrl = new URL(normalizedUrl);

    if (!['redis:', 'rediss:'].includes(parsedUrl.protocol)) {
      throw new Error('REDIS_URL must start with redis:// or rediss://');
    }

    return {
      REDIS_URL: normalizedUrl,
    };
  }

  const redisHost = config.REDIS_HOST;
  const redisHostUrl = redisHost ? extractRedisUrl(redisHost) : null;

  if (redisHostUrl) {
    const parsedUrl = new URL(redisHostUrl);

    if (!['redis:', 'rediss:'].includes(parsedUrl.protocol)) {
      throw new Error('Redis URL must start with redis:// or rediss://');
    }

    return {
      REDIS_URL: redisHostUrl,
    };
  }

  const redisPort = Number(config.REDIS_PORT);

  if (!redisHost || redisHost.trim().length === 0) {
    throw new Error('REDIS_HOST is required when REDIS_URL is not provided');
  }

  if (!Number.isInteger(redisPort) || redisPort <= 0) {
    throw new Error('REDIS_PORT must be a positive integer');
  }

  return {
    REDIS_HOST: redisHost,
    REDIS_PORT: redisPort,
  };
}

export function validateEnvironment(config: EnvironmentConfig) {
  const databaseUrl = readRequired(config, 'DATABASE_URL');
  const directUrl = config.DIRECT_URL;

  return {
    ...config,
    DATABASE_URL: validatePostgresUrl(databaseUrl, 'DATABASE_URL'),
    DIRECT_URL: directUrl
      ? validatePostgresUrl(directUrl, 'DIRECT_URL')
      : undefined,
    SUPABASE_URL: validateOptionalSupabaseUrl(
      config.SUPABASE_URL,
      'SUPABASE_URL',
    ),
    SUPABASE_PUBLISHABLE_KEY: config.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: config.SUPABASE_SECRET_KEY,
    SUPABASE_JWKS_URL: validateOptionalSupabaseUrl(
      config.SUPABASE_JWKS_URL,
      'SUPABASE_JWKS_URL',
    ),
    NODE_ENV: config.NODE_ENV || 'development',
    CORS_ORIGIN: config.CORS_ORIGIN || '*',
    COOKIE_SECURE: config.COOKIE_SECURE,
    ZKTECO_TIMEOUT_MS: readOptionalNonNegativeInteger(
      config,
      'ZKTECO_TIMEOUT_MS',
      10000,
    ),
    ZKTECO_LOCAL_PORT: readOptionalNonNegativeInteger(
      config,
      'ZKTECO_LOCAL_PORT',
      0,
    ),
    ZKTECO_PROTOCOL: validateZktecoProtocol(config.ZKTECO_PROTOCOL),
    ...validateRedis(config),
    PORT: readPort(config, 'PORT'),
  };
}
