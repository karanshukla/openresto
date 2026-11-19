---
title: Backup and restore
description: What to save, how to save it, and how to get it back.
sidebar:
  order: 9
---

All persistent OpenResto data lives in two Docker volumes, with no separate database server or external storage service required.

## What to back up

| Item                          | Location                                   | Why it matters                                                                                                                               |
| ----------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| SQLite database (`openresto.db`) | `/data` in `backend` (volume `db_data`)    | Stores all bookings, locations, tables, accounts, branding, and email settings.                                                              |
| Data Protection keys          | `/data/dp-keys` (same `db_data` volume)    | Encrypts the saved SMTP password and guest "recent bookings" cookies. Losing them requires re-entering the SMTP password; bookings are safe. |
| Uploaded media                | `/app/wwwroot/media` (volume `media_data`) | Hero image, location photos, and menu PDFs.                                                                                                  |
| `.env` and `docker-compose.yml` | Next to each other on the host             | Secrets and configuration, including the VAPID keys browsers subscribed with.                                                                |
| `./wallet`, `./well-known`    | Next to `docker-compose.yml`               | Required only if you configured Wallet passes or a native app.                                                                               |

Run the commands below from the directory containing `docker-compose.yml`. They attach to volumes via `--volumes-from`, so they work regardless of how Docker prefixes volume names (for example, `openresto_db_data` in `docker volume ls`).

## Back up

Stopping the backend briefly ensures SQLite flushes all writes for a clean archive. The site is briefly unavailable during the copy.

```bash
mkdir -p backups
docker compose stop backend

docker run --rm --volumes-from "$(docker compose ps -aq backend)" \
  -v "$PWD/backups":/backups alpine \
  tar czf "/backups/openresto-$(date +%Y%m%d-%H%M%S).tar.gz" -C / data app/wwwroot/media

docker compose start backend
```

This archive contains the database, Data Protection keys, and uploaded media. Store copies of both `.env` and `backups/` off the server so a disk failure does not destroy your backups.

### Online database snapshot (no downtime)

To back up the database without stopping OpenResto, use SQLite's online `.backup` command and copy the resulting file out:

```bash
docker compose exec backend sqlite3 /data/openresto.db ".backup /data/openresto-snapshot.db"

docker run --rm --volumes-from "$(docker compose ps -aq backend)" \
  -v "$PWD/backups":/backups alpine \
  mv /data/openresto-snapshot.db "/backups/openresto-$(date +%Y%m%d-%H%M%S).db"
```

This backs up the database only. Archive uploaded media separately whenever it changes.

## Restore

Restoring overwrites the current contents of both volumes. Take a fresh backup first if you are unsure.

```bash
docker compose stop backend

# Replace TIMESTAMP with the backup archive you want to restore.
docker run --rm --volumes-from "$(docker compose ps -aq backend)" \
  -v "$PWD/backups":/backups alpine \
  sh -c 'rm -rf /data/* /app/wwwroot/media/* && tar xzf /backups/openresto-TIMESTAMP.tar.gz -C /'

docker compose start backend
```

To restore a `.db` snapshot instead, stop the backend, copy the snapshot over `/data/openresto.db`, remove any leftover `openresto.db-wal` and `openresto.db-shm` files beside it, and start the backend again.

Verify database integrity afterward:

```bash
docker compose exec backend sqlite3 /data/openresto.db "PRAGMA integrity_check;"
# ok
```

## Automatic daily backups

This script creates an online database snapshot every night and retains seven days of backups. Save it as `/opt/openresto/backup.sh`, update `COMPOSE_DIR` to your install directory, and make it executable (`chmod +x /opt/openresto/backup.sh`):

```bash
#!/bin/sh
set -e

COMPOSE_DIR=/opt/openresto
BACKUP_DIR="$COMPOSE_DIR/backups"
DATE=$(date +%Y%m%d-%H%M%S)

cd "$COMPOSE_DIR"
mkdir -p "$BACKUP_DIR"

docker compose exec -T backend sqlite3 /data/openresto.db ".backup /data/openresto-snapshot.db"
docker run --rm --volumes-from "$(docker compose ps -aq backend)" \
  -v "$BACKUP_DIR":/backups alpine \
  mv /data/openresto-snapshot.db "/backups/openresto-$DATE.db"

# Keep seven days.
find "$BACKUP_DIR" -name "openresto-*.db" -mtime +7 -delete

echo "$DATE backup complete: $BACKUP_DIR/openresto-$DATE.db"
```

Schedule it at 3:00 a.m. in `/etc/cron.d/openresto-backup`:

```txt
0 3 * * * root /opt/openresto/backup.sh >> /var/log/openresto-backup.log 2>&1
```

## Using `docker-compose.vps.yml`

`docker-compose.vps.yml` stores the database in a host `./data` directory instead of a named volume. The commands above still work because `--volumes-from` follows bind mounts, or you can copy `./data` directly while the backend is stopped:

```bash
docker compose -f docker-compose.vps.yml stop backend
cp -r ./data "./backups/openresto-data-$(date +%Y%m%d-%H%M%S)"
docker compose -f docker-compose.vps.yml start backend
```

Pass `-f docker-compose.vps.yml` to every `docker compose` command on this page when using the VPS compose file.

## Before an upgrade

Always back up before upgrading. New releases apply database migrations automatically on startup, and older versions may not be compatible with a migrated schema. See [Upgrading](/self-hosting/upgrading/).
