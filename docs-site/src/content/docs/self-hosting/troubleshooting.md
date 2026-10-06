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
- Sign-in is limited to 10 attempts a minute per IP address, so after several failed tries,
  wait a minute before the next one.

## 502 from the reverse proxy

The proxy starts only after the backend and frontend report healthy. If you see a 502 straight
after a restart, wait for `docker compose ps` to show every service healthy. If it persists, read the
backend logs.

## Uploads fail

The size limits are 5 MB for the hero image, 2 MB for a location photo and 10 MB for a menu
PDF. The bundled proxy allows 12 MB requests. If you put your own proxy in front, allow at
least 12 MB there too (`client_max_body_size 12M;` in nginx).

## No emails

See [Email](/self-hosting/email/#if-mail-does-not-arrive). The SMTP settings live in the admin,
not in `.env`.

## No push notifications

Push needs HTTPS and all three VAPID values. The settings card's message tells you which is missing, see [Push notifications](/self-hosting/push-notifications/#what-the-toggle-is-telling-you).

## Guests see "Too many requests"

Guest pages allow 120 requests a minute per IP address, and booking lookups 10. Guests behind
one shared address (hotel Wi-Fi, a mobile carrier) count as one visitor. Check that your proxy
forwards `X-Forwarded-For`, otherwise **every** guest looks like your proxy's address. The
limits themselves are fixed, see [Configuration](/self-hosting/configuration/#fixed-limits).

## Emails or passes link to localhost

The server is using its development address. Set `CORS_ORIGINS` to your public address, see [Which URL goes where](/self-hosting/domains-and-urls/).

## Still stuck

Search the [issues](https://github.com/karanshukla/openresto/issues). If you can't find your
problem, open one with your version (`docker compose images`), what you expected, and the
relevant log lines. Remove secrets from anything you paste.
