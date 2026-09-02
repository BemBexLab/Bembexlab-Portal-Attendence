# Production Deployment

Target: Linux VPS with Node.js, PM2, VPS-hosted PostgreSQL, and Redis.

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

Set both `DATABASE_URL` and `DIRECT_URL` to the VPS PostgreSQL connection string. The application does not use Supabase for runtime data or migrations.

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

Keep encrypted off-server copies of VPS PostgreSQL backups. Application-owned exports are recommended before releases and migrations.

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
