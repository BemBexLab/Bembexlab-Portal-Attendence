const { spawnSync, spawn } = require('node:child_process');
const Redis = require('ioredis');
const { Client } = require('pg');

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const client = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('PostgreSQL is ready.');
      return;
    } catch (error) {
      await client.end().catch(() => undefined);
      console.log(`Waiting for PostgreSQL (${attempt}/30): ${error.message}`);
      await sleep(2000);
    }
  }

  throw new Error('PostgreSQL did not become ready in time.');
}

async function waitForRedis() {
  if (!redisUrl) {
    return;
  }

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });

    try {
      await redis.connect();
      await redis.ping();
      await redis.quit();
      console.log('Redis is ready.');
      return;
    } catch (error) {
      redis.disconnect();
      console.log(`Waiting for Redis (${attempt}/30): ${error.message}`);
      await sleep(2000);
    }
  }

  throw new Error('Redis did not become ready in time.');
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function main() {
  await waitForPostgres();
  await waitForRedis();

  if (process.env.RUN_MIGRATIONS !== 'false') {
    run('npx', ['prisma', 'migrate', 'deploy']);
  }

  if (process.env.RUN_SEED === 'true') {
    run('npm', ['run', 'prisma:seed']);
  }

  const server = spawn('node', ['dist/main.js'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  server.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
