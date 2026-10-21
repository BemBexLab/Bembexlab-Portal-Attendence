# Production Deployment

Target: Linux VPS with Node.js, PM2, and PostgreSQL.

## Server Requirements

- Node.js 22 LTS or newer
- npm
- PM2: `npm install -g pm2`
- PostgreSQL client tools for backups: `sudo apt install postgresql-client`

## Backend

```bash
cd /var/www/bembex-portal
cp server/.env.production.example .env
cd server
npm ci
npm run prisma:generate
npm run build
npm run db:check
```

Set both `DATABASE_URL` and `DIRECT_URL` to the VPS PostgreSQL connection string. The application does not use Supabase for runtime data or migrations.

Health check:

```bash
curl http://localhost:4000/api/health
```

## Frontend on Vercel

Deploy `client/` from the GitHub repository with Vercel's Root Directory set to
`client`. Add `API_URL` to the Vercel project environment variables for
Production and Preview. It must be the public VPS API origin, for example
`https://api.example.com`, without an `/api` suffix. Redeploy after setting it.

Also set `PORTAL_PASSWORD` to the shared portal login password and
`PORTAL_AUTH_SECRET` to a separate, long random signing key in both Vercel
environments. Keep these values private. For local development, set the same
two variables in the repository-root `.env`; choose your own portal password.
Both `client/` and `server/` load that root file locally, so do not duplicate
portal auth values in `client/.env.local` or `server/.env`.
Sessions are signed, HttpOnly cookies that expire after 12 hours. Changing
`PORTAL_AUTH_SECRET` invalidates existing sessions.

The browser calls the same-origin `/api` path; Next.js proxies
those requests to the VPS using `API_URL`. The repository-root `.env` is for
local development or VPS runtime only; it is Git-ignored and is not uploaded to
Vercel.

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

## Windows autostart

On Windows, PM2 itself does not register a boot service. After building the
server and client and starting the ecosystem once, save the process list:

```powershell
pm2 start ecosystem.config.cjs
pm2 save
```

Register a Scheduled Task to restore those saved processes whenever the PM2
user signs in:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
& .\scripts\install-pm2-autostart.ps1
```

To start PM2 at machine boot instead of user sign-in, run an elevated
PowerShell and use:

```powershell
& .\scripts\install-pm2-autostart.ps1 -AtStartup
```

The startup task runs `pm2 resurrect`, so it restores exactly the processes
captured by `pm2 save`. Keep the project paths and PM2 installation available
to the same Windows account that registered the task.

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
