# Backup and Restore

OpenResto is designed for zero-dependency self-hosting. All persistent data lives in Docker volumes — no external database or storage service to back up separately.

## What to back up

| Location | Contains | Priority |
|---|---|---|
| `/data/openresto.db` (volume `db_data`) | All bookings, restaurants, tables, sections, admin credentials, brand settings, push subscriptions | **Critical** |
| `/app/wwwroot/media` (volume `media_data`) | Uploaded images | Medium |
| `/data/dp-keys` (inside `db_data`) | ASP.NET Data Protection keys (encrypt the recent-bookings cookie) | Low — losing these clears the "my recent bookings" lookup but no booking data is lost |

## Before you back up

Checkpoint the SQLite WAL so the backup file is self-consistent:

```bash
docker compose exec backend sqlite3 /data/openresto.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

The backend also checkpoints automatically on graceful shutdown (`docker compose stop`), so stopping before copying is equally valid.

## Backing up named volumes (default install)

The release `docker-compose.yml` uses named volumes (`db_data`, `media_data`). Back them up by spinning up a temporary Alpine container that reads the volume and writes a tarball:

```bash
# Backup the database volume
docker run --rm \
  -v db_data:/data:ro \
  -v "$(pwd)/backups":/backups \
  alpine tar czf /backups/openresto-db-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .

# Backup the media volume
docker run --rm \
  -v media_data:/media:ro \
  -v "$(pwd)/backups":/backups \
  alpine tar czf /backups/openresto-media-$(date +%Y%m%d-%H%M%S).tar.gz -C /media .
```

> Replace `db_data` / `media_data` with the actual Docker volume names if you changed the project name (check with `docker volume ls`). The default names are `<project-directory-name>_db_data`.

## Backing up bind mounts (VPS/custom install)

If you mounted `./data:/data` directly (as in the `docker-compose.vps.yml`), just copy the directory:

```bash
cp -r ./data ./backups/openresto-data-$(date +%Y%m%d-%H%M%S)
```

## Restore

```bash
# 1. Stop the backend to avoid write conflicts
docker compose stop backend

# 2. Restore the database volume (replace TIMESTAMP with your backup's timestamp)
docker run --rm \
  -v db_data:/data \
  -v "$(pwd)/backups":/backups \
  alpine sh -c "rm -rf /data/* && tar xzf /backups/openresto-db-TIMESTAMP.tar.gz -C /data"

# 3. Restore the media volume (if needed)
docker run --rm \
  -v media_data:/media \
  -v "$(pwd)/backups":/backups \
  alpine sh -c "rm -rf /media/* && tar xzf /backups/openresto-media-TIMESTAMP.tar.gz -C /media"

# 4. Start everything back up
docker compose start backend
```

## Automated daily backups

Example cron job with 7-day retention:

```bash
# /etc/cron.d/openresto-backup
0 3 * * * root /opt/openresto/backup.sh >> /var/log/openresto-backup.log 2>&1
```

```bash
#!/bin/sh
# /opt/openresto/backup.sh
set -e

COMPOSE_DIR=/opt/openresto
BACKUP_DIR=/opt/openresto/backups
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Checkpoint WAL for a consistent copy
docker compose -f "$COMPOSE_DIR/docker-compose.yml" \
  exec -T backend sqlite3 /data/openresto.db "PRAGMA wal_checkpoint(TRUNCATE);" || true

# Backup database
docker run --rm \
  -v db_data:/data:ro \
  -v "$BACKUP_DIR":/backups \
  alpine tar czf "/backups/db-$DATE.tar.gz" -C /data .

# Remove backups older than 7 days
find "$BACKUP_DIR" -name "db-*.tar.gz" -mtime +7 -delete

echo "$DATE backup complete: $BACKUP_DIR/db-$DATE.tar.gz"
```

## Point-in-time online backup

For a live backup without stopping the backend, use SQLite's online backup API via the CLI:

```bash
docker compose exec backend sqlite3 /data/openresto.db \
  ".backup /data/openresto-snapshot.db"
```

This creates `/data/openresto-snapshot.db` inside the `db_data` volume. Copy it out with:

```bash
docker run --rm \
  -v db_data:/data:ro \
  -v "$(pwd)/backups":/backups \
  alpine cp /data/openresto-snapshot.db /backups/openresto-snapshot-$(date +%Y%m%d-%H%M%S).db
```

## Upgrading between versions

OpenResto applies EF Core database migrations automatically on startup — your data is safe across upgrades.

```bash
# 1. Back up first (see above)
# 2. Pull the new images
OPENRESTO_VERSION=v1.x.x docker compose -f docker-compose.yml pull
# 3. Restart — migrations run automatically before the health check passes
OPENRESTO_VERSION=v1.x.x docker compose -f docker-compose.yml up -d
```

The backend logs will show lines like:
```
Applying migration '20260604104824_NullableBookingTableSection'...
```

If a migration fails, the container exits with a non-zero status and the health check will not pass, so your reverse proxy keeps serving a meaningful error rather than a broken app. Restore from backup, report the issue, and wait for a patch.

## Checking database integrity

After a restore or before an upgrade:

```bash
docker compose exec backend sqlite3 /data/openresto.db "PRAGMA integrity_check;"
# Expected output: ok
```
