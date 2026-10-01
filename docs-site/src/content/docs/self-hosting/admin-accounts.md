---
title: Admin accounts and recovery
description: The first Owner account, adding staff, API keys, and getting back in when locked out.
sidebar:
  order: 7
---

This page covers your admin accounts: the first one, adding staff, API keys and getting back in
if you're locked out.

## The first account

The first time OpenResto starts with no accounts, it creates an **Owner** from `ADMIN_EMAIL`
and `ADMIN_PASSWORD`. After that, these two settings are ignored, so changing `ADMIN_PASSWORD`
in `.env` won't change your password. Change it from the admin, or use the recovery script below.

Please choose a long, unique password, since anyone who can reach `/admin` can try to sign in.

## More people

Owners can add other accounts from the admin. Accounts have a role, **Owner** or **Manager**,
and can be deactivated without being deleted.

## API keys

Owners can create API keys under **Settings → API Keys** for scripts, integrations and the
[`openresto-cli`](https://github.com/karanshukla/openresto/tree/main/openresto-cli). Each key is
tied to the person who made it and only has the permissions you give it. See
[Calling the API](/api/authentication/).

## Locked out

`scripts/reset-admin.sh` from the repository resets one account's login and makes it an
active Owner again. Your bookings, locations and media are left alone. Run it on
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

If you leave out `--password`, the script makes a random password and shows it once, so note it
down. You can pass `--password` on the command line, but other users on the server could see it,
so `.env` or the generated password is safer.

It resets the account whose email matches `--email`, or the lowest-numbered account if none
matches, and clears its security question and any pending reset token. Other accounts are not
changed.
