---
title: Upgrading
description: Move to a new OpenResto release safely.
sidebar:
  order: 8
---

The backend applies database migrations automatically on startup, so upgrading comes down to backing up, pulling the new images, and restarting the stack.

## Steps

1. **Review the changelog:** Read [CHANGELOG.md](https://github.com/karanshukla/openresto/blob/main/CHANGELOG.md) for every release between your current version and the target version. Check your running version with `docker compose images`.
2. **Back up your data:** Take a backup of the database and media volumes before upgrading (see [Backup and restore](/self-hosting/backup-restore/)).
3. **Update `docker-compose.yml`:** Release compose files pin exact image tags, so download the new release's compose file to move forward (it also includes any new optional environment variables):

   ```bash
   cp docker-compose.yml docker-compose.yml.bak
   curl -fsSLO https://github.com/karanshukla/openresto/releases/latest/download/docker-compose.yml
   ```

   To upgrade to a specific tag, replace `latest/download` with `download/v2.4.0` (using your target tag).

   If you use `docker-compose.release.yml` from the repository instead, skip this step and update `OPENRESTO_VERSION` in `.env` (or leave it unset to track `latest`).

4. **Pull and restart:**

   ```bash
   docker compose pull
   docker compose up -d
   ```

5. **Verify the upgrade:**

   ```bash
   docker compose ps
   curl -f http://localhost/api/health
   docker compose logs backend --tail 50
   ```

   During migration, backend logs show entries such as `Applying migration '20260604104824_NullableBookingTableSection'`.

## If something goes wrong

If a database migration fails, the backend exits rather than running in a partially migrated state, leaving your data intact while the site stays offline. To roll back:

1. Restore your pre-upgrade backup (see [Backup and restore](/self-hosting/backup-restore/#restore)).
2. Restore the previous compose file: `mv docker-compose.yml.bak docker-compose.yml`.
3. Restart the stack: `docker compose up -d`.

Then [open an issue](https://github.com/karanshukla/openresto/issues) with the backend logs.

Always restore your backup when downgrading: an older OpenResto version may not be compatible with a database schema migrated by a newer release.
