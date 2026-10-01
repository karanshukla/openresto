---
title: Backup and restore
sidebar:
  order: 9
---

This page shows what to back up and how to restore it. Everything OpenResto saves lives in Docker volumes (storage areas managed by Docker), so there's no separate database or storage service to back up.

## What to back up

| Location | Contains | Priority |
|---|---|---|
| `/data/openresto.db` (volume `db_data`) | All bookings, restaurants, tables, sections, admin credentials, brand settings, push subscriptions | **Critical** |
| `/app/wwwroot/media` (volume `media_data`) | Uploaded images | Medium |
| `/data/dp-keys` (inside `db_data`) | ASP.NET Data Protection keys (encrypt the recent-bookings cookie) | Low. Losing these clears the "my recent bookings" lookup, but no booking data is lost |

## Before you back up

First, flush pending writes (the SQLite WAL) so the backup is complete:

```bash
docker compose exec backend sqlite3 /data/openresto.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

This also happens automatically when you stop the backend with `docker compose stop`, so stopping before you copy works too.

## Backing up named volumes (default install)

The release `docker-compose.yml` uses named volumes (`db_data`, `media_data`). Back them up with a temporary Alpine container that reads the volume and saves a `.tar.gz` file:

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

> If you changed the project name, use your real volume names instead of `db_data` / `media_data` (check with `docker volume ls`). The default names are `<project-directory-name>_db_data`.

## Backing up bind mounts (VPS/custom install)

If you mounted `./data:/data` directly (as in the `docker-compose.vps.yml`), copy the directory:

```bash
cp -r ./data ./backups/openresto-data-$(date +%Y%m%d-%H%M%S)
```

## Restore

```bash
# 1. Stop the backend so nothing is written during the restore
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

:::caution
The restore replaces what is currently in the volumes. If you are unsure, take a fresh backup first.
:::

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

To back up while OpenResto keeps running, use SQLite's online backup:

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

The database updates itself when OpenResto starts, and your data is kept. Still, please back up first. See also [Upgrading](/self-hosting/upgrading/).

```bash
# 1. Back up first (see above)
# 2. Pull the new images
OPENRESTO_VERSION=v1.x.x docker compose -f docker-compose.yml pull
# 3. Restart (the database updates itself before the health check passes)
OPENRESTO_VERSION=v1.x.x docker compose -f docker-compose.yml up -d
```

The backend logs will show lines like:
```
Applying migration '20260604104824_NullableBookingTableSection'...
```

If the update fails, the backend stops and you see an error page instead of a broken app. Restore from your backup and report the issue.

## Checking database integrity

Run this after a restore or before an upgrade:

```bash
docker compose exec backend sqlite3 /data/openresto.db "PRAGMA integrity_check;"
# You should see: ok
```
