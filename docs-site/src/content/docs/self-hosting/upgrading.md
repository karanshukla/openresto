---
title: Upgrading
description: Move to a new OpenResto release safely.
sidebar:
  order: 8
---

This page shows how to move to a new OpenResto release. The database updates itself when the
backend starts, so an upgrade comes down to getting the new images and restarting. The steps
below take a backup first, so you can always go back.

## Steps

1. **Read the changelog** for every version between yours and the new one:
   [CHANGELOG.md](https://github.com/karanshukla/openresto/blob/main/CHANGELOG.md). It points
   out anything you need to do. `docker compose images` shows the version you run now.
2. **Back up** the database and media volumes. See [Backup and restore](/self-hosting/backup-restore/).
3. **Get the new `docker-compose.yml`.** The file attached to each release names its own
   version, so replacing it is what moves you forward:

   ```bash
   cp docker-compose.yml docker-compose.yml.bak
   curl -fsSLO https://github.com/karanshukla/openresto/releases/latest/download/docker-compose.yml
   ```

   For a specific release, swap `latest/download` for `download/v2.4.0` (with your version).
   The new file also carries any new optional settings, so it is worth taking even when only
   the version changed.

   If you run `docker-compose.release.yml` from the repository instead, skip this step and
   change `OPENRESTO_VERSION` in `.env`, or leave it unset to follow `latest`.

4. **Pull and restart:**

   ```bash
   docker compose pull
   docker compose up -d
   ```

5. **Check it came up:**

   ```bash
   docker compose ps
   curl -f http://localhost/api/health
   docker compose logs backend --tail 50
   ```

   While the database updates, the logs show lines like
   `Applying migration '20260604104824_NullableBookingTableSection'`.

## If something goes wrong

If the database update fails, the backend stops rather than running half-updated, so the site
stays offline until it is sorted. Your data is safe. To go back:

1. Restore your backup (see [Backup and restore](/self-hosting/backup-restore/#restore)).
2. Put back the old file: `mv docker-compose.yml.bak docker-compose.yml`.
3. `docker compose up -d`.

Then [open an issue](https://github.com/karanshukla/openresto/issues) with the log output.

Always restore a backup when you go back to an older version. A newer database may contain
changes that the older version doesn't understand.
