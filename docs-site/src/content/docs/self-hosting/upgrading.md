---
title: Upgrading
description: Move to a new OpenResto release safely.
sidebar:
  order: 7
---

Database migrations run automatically when the backend starts, so an upgrade is pulling the new
images and restarting. The steps below add a backup, which is what makes it reversible.

## Steps

1. **Read the changelog** for the versions you are skipping:
   [CHANGELOG.md](https://github.com/karanshukla/openresto/blob/main/CHANGELOG.md). Anything that
   needs action from you is called out there.
2. **Back up** the database and media volumes. See [Backup and restore](/self-hosting/backup-restore/).
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

A failed migration stops the backend with a non-zero exit, and its health check never passes, so
you get an error page rather than a half-migrated app. Restore your backup, pin the previous
version with `OPENRESTO_VERSION`, and
[open an issue](https://github.com/karanshukla/openresto/issues) with the log output.

Going back to an older version without restoring a backup is not supported: a newer database may
contain changes the older code does not know about.
