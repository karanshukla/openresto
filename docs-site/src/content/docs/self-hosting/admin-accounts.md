---
title: Admin accounts and recovery
description: The first Owner account, adding staff, API keys, and getting back in when locked out.
sidebar:
  order: 7
---

This page covers managing admin accounts, staff roles, API keys, and account recovery.

## The first account

When OpenResto starts with an empty database, it creates the initial **Owner** account from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. On subsequent starts, those two environment variables are ignored. Updating `ADMIN_PASSWORD` in `.env` will not change your password; update it under **Settings → Account** or run the recovery script below.

Choose a long, unique password, because `/admin` is reachable by anyone who can access your site.

## Adding staff

Owners can create additional accounts under **Settings → Users**. Each account has one of two roles:

- **Owner:** Full access, including user management, API keys, the activity log, website widget settings, and deleting locations.
- **Manager:** Manages bookings, locations, tables, sections, and brand settings.

Accounts can be deactivated without deleting them. At least one active Owner must remain at all times, and you cannot deactivate yourself or change your own role.

## API keys

Owners can create API keys under **Settings → API Keys** for scripts, integrations, and [`openresto-cli`](https://github.com/karanshukla/openresto/tree/main/openresto-cli). Each key inherits the permissions of the user who created it and is restricted to its assigned scopes. See [Calling the API](/api/authentication/).

## Locked out

If you are locked out, run `scripts/reset-admin.sh` on the server hosting your containers to reset an account's login and restore it as an active Owner. Bookings, locations, and uploaded media are not affected. The script requires `python3` and Docker on the host.

Because the script looks for `.env` in its parent directory, download it into a `scripts/` folder inside your install directory:

```bash
cd openresto                      # folder containing docker-compose.yml and .env
mkdir -p scripts
curl -fsSLo scripts/reset-admin.sh https://raw.githubusercontent.com/karanshukla/openresto/main/scripts/reset-admin.sh
chmod +x scripts/reset-admin.sh
```

Set the desired email and new password in `.env` (`ADMIN_EMAIL` and `ADMIN_PASSWORD`), then run the script with your compose file:

```bash
./scripts/reset-admin.sh --compose-file docker-compose.yml
```

What the script does:

- Resets the account matching `ADMIN_EMAIL` (or the lowest-ID account if none matches) and sets its email to that address.
- Clears that account's security question and any pending reset token without modifying other accounts.
- Generates a random password and prints it once if `ADMIN_PASSWORD` is unset in `.env`.

You can also pass `--email` and `--password` as flags, though `.env` or a generated password is safer because command-line arguments are visible to other local users.
