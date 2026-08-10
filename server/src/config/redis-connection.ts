import type { RedisOptions } from 'ioredis';

export type RedisConnectionConfig = {
  options: RedisOptions;
  label: string;
};

export function extractRedisUrl(value: string) {
  const match = value.match(/redis[s]?:\/\/\S+/);
  return match ? match[0].replace(/^["']|["']$/g, '') : null;
}

function parseRedisUrl(redisUrl: string): RedisConnectionConfig {
  const extractedUrl = extractRedisUrl(redisUrl);

  if (!extractedUrl) {
    throw new Error('REDIS_URL must start with redis:// or rediss://');
  }

  const parsedUrl = new URL(extractedUrl);

  if (!['redis:', 'rediss:'].includes(parsedUrl.protocol)) {
    throw new Error('REDIS_URL must start with redis:// or rediss://');
  }

  const port =
    Number(parsedUrl.port) || (parsedUrl.protocol === 'rediss:' ? 6380 : 6379);
  const db = parsedUrl.pathname ? Number(parsedUrl.pathname.slice(1)) : 0;

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('REDIS_URL contains an invalid port');
  }

  if (!Number.isInteger(db) || db < 0) {
    throw new Error('REDIS_URL contains an invalid database index');
  }

  return {
    label: `${parsedUrl.hostname}:${port}`,
    options: {
      host: parsedUrl.hostname,
      port,
      username: parsedUrl.username
        ? decodeURIComponent(parsedUrl.username)
        : undefined,
      password: parsedUrl.password
        ? decodeURIComponent(parsedUrl.password)
        : undefined,
      db,
      tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
    },
  };
}

export function createRedisConnectionConfig(
  config: Record<string, string | number | undefined>,
): RedisConnectionConfig {
  const redisUrl = config.REDIS_URL;

  if (typeof redisUrl === 'string' && redisUrl.trim().length > 0) {
    return parseRedisUrl(redisUrl);
  }

  const host = config.REDIS_HOST;
  const port = Number(config.REDIS_PORT);

  if (typeof host !== 'string' || host.trim().length === 0) {
    throw new Error('REDIS_HOST is required when REDIS_URL is not provided');
  }

  const hostRedisUrl = extractRedisUrl(host);

  if (hostRedisUrl) {
    return parseRedisUrl(hostRedisUrl);
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('REDIS_PORT must be a positive integer');
  }

  return {
    label: `${host}:${port}`,
    options: {
      host,
      port,
    },
  };
}
