# Production Deployment

## Docker Deployment

This repository now includes Docker for the complete stack:

- `postgres:16-alpine`
- `redis:7-alpine`
- NestJS API
- Next.js web app

Start everything:

```bash
docker compose up -d --build
```

Open:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

The Docker API container uses:

```env
DATABASE_URL=postgresql://bembex:bembex_password@postgres:5432/bembex?schema=public
REDIS_URL=redis://redis:6379
```

On first boot, the API container waits for PostgreSQL and Redis, runs Prisma migrations, seeds the initial organization/admin/employee/device, then starts NestJS.

Useful commands:

```bash
docker compose logs -f server
docker compose logs -f client
docker compose restart server
docker compose down
docker compose down -v
```

`docker compose down -v` deletes the PostgreSQL and Redis volumes. Use it only when you intentionally want to reset all local data.

### Docker Database Backup

Create a local backup from the Docker PostgreSQL container:

```bash
docker compose exec postgres pg_dump -U bembex -d bembex --format=custom --no-owner --no-acl --file=/tmp/bembex.dump
docker cp bembex-postgres:/tmp/bembex.dump ./bembex.dump
```

Restore:

```bash
docker cp ./bembex.dump bembex-postgres:/tmp/bembex.dump
docker compose exec postgres pg_restore -U bembex -d bembex --clean --if-exists --no-owner --no-acl /tmp/bembex.dump
```

### ZKTeco K40Eco With Docker

The seeded Docker device is:

```json
{ "ip": "192.168.10.197", "port": 4370 }
```

The API container can only sync the K40Eco if the Docker host can route to that private IP. Verify from the host:

```bash
ping 192.168.10.197
nc -vz 192.168.10.197 4370
```

Then verify from the API container:

```bash
docker compose exec server npm run device:test -- 192.168.10.197 4370
```

If the Docker host is on another subnet, add routing/VPN or move the K40Eco into the same subnet. On Linux, if bridge networking cannot reach the device but the host can, use the included host-network override:

```bash
docker compose -f docker-compose.yml -f docker-compose.k40-linux.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.k40-linux.yml exec server npm run device:test -- 192.168.10.197 4370
```

That override runs only the API container on the host network and changes its Postgres/Redis URLs to `127.0.0.1`, using the ports already published by the Docker Postgres and Redis services.

Equivalent manual Compose setting:

```yaml
network_mode: host
```

When using `network_mode: host`, remove the `server` service `ports` mapping and change `DATABASE_URL`/`REDIS_URL` to reach PostgreSQL/Redis through host-published ports or run those services externally.

---

# Production Deployment Without Docker

Target: Linux VPS with Node.js, PM2, PostgreSQL access through Supabase, and Redis.

## Server Requirements

- Node.js 22 LTS or newer
- npm
- PM2: `npm install -g pm2`
- PostgreSQL client tools for backups: `sudo apt install postgresql-client`
- Redis reachable from the VPS
- Network route from the API host to the ZKTeco K40 device

The K40 IP `192.168.10.197` is private LAN space. A public VPS cannot reach it unless the VPS is on the same LAN, connected by VPN, or the device network exposes a secure route to TCP `4370`.

## Backend

```bash
cd /var/www/bembex-portal/server
cp .env.production.example .env
npm ci
npm run prisma:generate
npm run build
npm run db:check
npm run prisma:seed
```

Use Supabase pooled PostgreSQL for `DATABASE_URL`. Use the direct PostgreSQL URL for `DIRECT_URL` when reachable. If the direct host is IPv6-only from the VPS, use Supabase's pooler URL for runtime and run migrations from a host that can reach the direct database.

Health check:

```bash
curl http://localhost:4000/health
```

## Frontend

```bash
cd /var/www/bembex-portal/client
cp .env.production.example .env.production
npm ci
npm run build
```

`NEXT_PUBLIC_API_URL` must point to the public API origin, for example `https://api.example.com`.

## PM2

From the repository root:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Common commands:

```bash
pm2 status
pm2 logs bembex-api
pm2 restart bembex-api
pm2 restart bembex-web
```

## Redis

Use a managed Redis or install Redis on the VPS:

```bash
sudo apt install redis-server
sudo systemctl enable --now redis-server
```

For production prefer `REDIS_URL`:

```env
REDIS_URL="redis://default:password@host:6379"
```

BullMQ attendance workers use Redis, so `/health` should report Redis as `ok`.

## Database Backup

Create backups with:

```bash
APP_DIR=/var/www/bembex-portal scripts/backup-database.sh
```

Recommended cron:

```cron
15 2 * * * APP_DIR=/var/www/bembex-portal /var/www/bembex-portal/scripts/backup-database.sh >> /var/log/bembex-db-backup.log 2>&1
```

Restore:

```bash
APP_DIR=/var/www/bembex-portal scripts/restore-database.sh /var/www/bembex-portal/backups/database/file.dump
```

Keep encrypted off-server copies of backups. Supabase managed backups are useful, but application-owned exports are still recommended before releases and migrations.

## ZKTeco K40 Sync

The seeded device is:

```json
{ "ip": "192.168.10.197", "port": 4370 }
```

The frontend Devices page now calls:

- `POST /devices/:id/test`
- `GET /devices/:id/info`
- `POST /devices/:id/sync-attendance`

`ZKTECO_LOCAL_PORT=0` lets the operating system choose a free UDP source port for each connection attempt. Set a fixed local port only if your network/firewall requires it.

If sync fails from a VPS, check routing first:

```bash
nc -vz 192.168.10.197 4370
```

If the VPS is not on the K40 network, use a site-to-site VPN, Tailscale/WireGuard, or run the API on the same local network.
