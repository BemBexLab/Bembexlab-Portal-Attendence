type EnvironmentConfig = Record<string, string | undefined>;

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

function validatePostgresUrl(value: string, key: string) {
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
    throw new Error(
      `${key} must be a PostgreSQL connection string`,
    );
  }

  if (value.includes('REPLACE_WITH') || value.includes('REGION')) {
    throw new Error(`${key} still contains placeholder values`);
  }

  return value;
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
    NODE_ENV: config.NODE_ENV || 'development',
    CORS_ORIGIN: config.CORS_ORIGIN || '*',
    COOKIE_SECURE: config.COOKIE_SECURE,
    PORT: readPort(config, 'PORT'),
  };
}
