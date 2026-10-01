---
title: Upgrading
description: Move to a new OpenResto release safely.
sidebar:
  order: 8
---

This page shows how to move to a new OpenResto release. The database updates itself when the
backend starts, so an upgrade is pulling the new images and restarting. The steps below add a
backup first, so you can always go back.

## Steps

1. **Read the changelog** for the versions you are skipping:
   [CHANGELOG.md](https://github.com/karanshukla/openresto/blob/main/CHANGELOG.md). It points out anything
   you need to do.
2. **Back up** the database and media volumes (the Docker storage areas). See [Backup and restore](/self-hosting/backup-restore/).
3. **Pull and restart:**

   ```bash
   docker compose pull
   docker compose up -d
   ```

   If you pinned a version, change `OPENRESTO_VERSION` first.
4. **Check it came up:**

   ```bash
   docker compose ps
   curl -f http://localhost/api/health
   docker compose logs backend --tail 50
   ```

Also refresh your `docker-compose.yml` from the new release when the changelog mentions new
settings, since new optional variables are added to it over time.

## If something goes wrong

If the database update fails, the backend stops and you see an error page instead of a
half-updated app. Your data is safe. Restore your backup, set the previous version with
`OPENRESTO_VERSION`, and
[open an issue](https://github.com/karanshukla/openresto/issues) with the log output.

Please restore a backup when you go back to an older version. A newer database may contain
changes that the older version doesn't understand.
