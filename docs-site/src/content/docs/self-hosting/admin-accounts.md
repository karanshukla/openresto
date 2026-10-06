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
in `.env` won't change your password. Change it from **Settings → Account**, or use the
recovery script below.

Please choose a long, unique password, since anyone who can reach `/admin` can try to sign in.

## More people

Owners can add other accounts under **Settings → Users**. Each account has a role:

- **Owner**: everything, including managing users, API keys and the activity log, and deleting
  locations.
- **Manager**: everything else, such as bookings, locations, tables and brand settings.

Accounts can be deactivated without being deleted. There is always at least one active Owner,
and you can't deactivate yourself or change your own role.

## API keys

Owners can create API keys under **Settings → API Keys** for scripts, integrations and the
[`openresto-cli`](https://github.com/karanshukla/openresto/tree/main/openresto-cli). Each key is
tied to the person who made it and only has the permissions you give it. See
[Calling the API](/api/authentication/).

## Locked out

`scripts/reset-admin.sh` from the repository resets one account's login and makes it an
active Owner again. Your bookings, locations and media are left alone. Run it on the server
that hosts the containers. It needs `python3` and Docker on the host.

The script looks for `.env` in the folder **above** its own, so download it into a `scripts`
folder inside your install directory:

```bash
cd openresto                      # the folder with docker-compose.yml and .env
mkdir -p scripts
curl -fsSLo scripts/reset-admin.sh https://raw.githubusercontent.com/karanshukla/openresto/main/scripts/reset-admin.sh
chmod +x scripts/reset-admin.sh
```

Put the email and new password you want in `.env` as `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then
run it, pointing it at your compose file:

```bash
./scripts/reset-admin.sh --compose-file docker-compose.yml
```

What it does:

- It resets the account whose email matches, or the lowest-numbered account (the first one
  created) if none matches, and sets that account's email to the one you gave.
- It clears that account's security question and any pending reset token. Other accounts are
  not changed.
- If `.env` has no `ADMIN_PASSWORD`, it makes up a random password and prints it once, so
  note it down.

You can also pass `--email` and `--password` on the command line, but other users on the server
can see command-line arguments, so `.env` or the generated password is safer.
