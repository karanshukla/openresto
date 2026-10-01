---
title: Admin accounts and recovery
description: The first Owner account, adding staff, API keys, and getting back in when locked out.
sidebar:
  order: 7
---

## The first account

On first boot, when the database has no accounts, the backend creates an **Owner** from
`ADMIN_EMAIL` and `ADMIN_PASSWORD`. After that these two variables are ignored, so changing
`ADMIN_PASSWORD` in `.env` does not change your password. Change it from the admin, or use the
recovery script below.

Use a long, unique password. Anyone who can reach `/admin` can try it.

## More people

Owners can add other accounts from the admin. Accounts have a role, **Owner** or **Manager**,
and can be deactivated without being deleted.

## API keys

Owners can mint API keys under **Settings → API Keys** for scripts, integrations and the
[`openresto-cli`](https://github.com/karanshukla/openresto/tree/main/openresto-cli). Each key is
tied to the person who made it and carries only the permissions you grant. See
[Calling the API](/api/authentication/).

## Locked out

`scripts/reset-admin.sh` from the repository resets one account's login and forces it back to an
active Owner. It touches nothing else: bookings, locations and media are left alone. Run it on
the server that hosts the containers. It needs `python3` and Docker on the host.

```bash
# download it once
curl -fsSLO https://raw.githubusercontent.com/karanshukla/openresto/main/scripts/reset-admin.sh
chmod +x reset-admin.sh
```

The script reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from a `.env` one directory above it, and
defaults to `docker-compose.vps.yml`. For a release install, point it at your compose file:

```bash
# put the new values in .env, then:
./reset-admin.sh --compose-file docker-compose.yml
```

Leave out `--password` and the script generates a random one and prints it once. Passing
`--password` on the command line works, but the value is visible to other users via `ps`, so
prefer `.env` or the generated password.

It rewrites the account whose email matches `--email`, or the lowest-numbered account if none
does, and clears its security question and any pending reset token. Other accounts are
untouched.
