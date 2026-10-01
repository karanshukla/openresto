---
title: Troubleshooting
description: Common problems when running OpenResto, and where to look first.
sidebar:
  order: 10
---

This page helps you find out what's wrong when something doesn't work. Start with the logs,
which usually name the problem:

```bash
docker compose ps
docker compose logs backend --tail 100
docker compose logs reverse-proxy --tail 100
```

## The backend keeps restarting

Look at the first error in `docker compose logs backend`.

- **A message about `Jwt:Key` or `JWT_KEY`**: it's missing or shorter than 32 characters.
  Generate one with `openssl rand -base64 48`.
- **A message about CORS origins**: `CORS_ORIGINS` is missing, or contains a wildcard (`*`), which isn't allowed.
- **`Admin:Password must be configured`**: the database is empty and `ADMIN_PASSWORD` is unset.
- **A permissions error writing `/data`**: the volume is a bind mount owned by another user.
  Named volumes avoid this, because the container fixes ownership of `/data` and the media
  directory when it starts.

## I cannot sign in to the admin

- Confirm you are using `ADMIN_EMAIL` and `ADMIN_PASSWORD` **from the first boot**. Editing them
  later has no effect. See [Admin accounts](/self-hosting/admin-accounts/) to reset.
- If the page loads but sign-in fails, check `CORS_ORIGINS` matches the address in your
  browser's address bar exactly: same scheme, host and port.
- Behind a proxy, check it forwards `X-Forwarded-Proto`, see [HTTPS](/self-hosting/https/).
- Sign-in attempts are rate limited per IP address per minute, so after several failed tries you may need to wait a minute.

## 502 from the reverse proxy

The proxy starts only after the backend and frontend report healthy. If you see a 502 straight
after a restart, wait for `docker compose ps` to show every service healthy. If it persists, read the
backend logs.

## Uploads fail

Hero images can be up to 5 MB and menu PDFs up to 10 MB. The bundled proxy allows 12 MB
uploads. If you use your own proxy, please allow at least that.

## No emails

See [Email](/self-hosting/email/#if-mail-does-not-arrive). The SMTP settings live in the admin,
not in `.env`.

## No push notifications

Push needs HTTPS and all three VAPID values. The settings card's message tells you which is missing, see [Push notifications](/self-hosting/push-notifications/#what-the-toggle-is-telling-you).

## Emails or passes link to localhost

The server is using its development address. Set `CORS_ORIGINS` to your public address, see [Which URL goes where](/self-hosting/domains-and-urls/).

## Still stuck

Search the [issues](https://github.com/karanshukla/openresto/issues). If you can't find your
problem, please open one with your version (`docker compose images`), what you expected, and the relevant log lines.
Please remove secrets from anything you paste.
