---
title: Troubleshooting
description: Common problems when running OpenResto, and where to look first.
sidebar:
  order: 10
---

When something does not work as expected, start by checking container status and logs:

```bash
docker compose ps
docker compose logs backend --tail 100
docker compose logs reverse-proxy --tail 100
```

## The backend keeps restarting

Check the first error in `docker compose logs backend`:

- **Error mentioning `Jwt:Key` or `JWT_KEY`:** The key is missing or shorter than 32 characters. Generate one with `openssl rand -base64 48`.
- **Error mentioning CORS origins:** `CORS_ORIGINS` is empty or contains a wildcard (`*`), which is rejected.
- **`Admin:Password must be configured`:** The database is empty and `ADMIN_PASSWORD` is unset.
- **Permission denied writing `/data`:** Usually caused by a host bind mount owned by another user. Named Docker volumes avoid this because the container adjusts ownership of `/data` and the media directory on startup.

## I cannot sign in to the admin

- Use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values **from the first boot**. Editing them in `.env` afterward has no effect; see [Admin accounts](/self-hosting/admin-accounts/) to reset credentials.
- If the page loads but login fails, verify `CORS_ORIGINS` matches your browser's address bar exactly (same scheme, host, and port, no trailing slash).
- Behind a reverse proxy, confirm it forwards `X-Forwarded-Proto` (see [HTTPS](/self-hosting/https/)).
- Admin sign-in is rate-limited to 10 attempts per minute per IP. Wait a minute after repeated failures before retrying.

## 502 from the reverse proxy

`reverse-proxy` waits until `backend` and `frontend` pass health checks. If a `502` appears right after a restart, wait until `docker compose ps` reports every container healthy. If it persists, inspect `docker compose logs backend`.

## Uploads fail

OpenResto enforces upload size limits of 5 MB for the hero image, 2 MB for location photos, and 10 MB for menu PDFs. The bundled nginx allows requests up to 12 MB. If you run another reverse proxy in front, allow at least 12 MB there too (for example, `client_max_body_size 12M;` in nginx).

## No emails

SMTP settings are stored in the database and configured in the admin UI, not in `.env`. See [Email](/self-hosting/email/#if-mail-does-not-arrive).

## No push notifications

Web push requires HTTPS and all three VAPID variables. Check the status message on the admin settings card (see [Push notifications](/self-hosting/push-notifications/#what-the-toggle-is-telling-you)).

## Guests see "Too many requests"

Guest endpoints allow 120 requests/minute per IP, and reference lookups allow 10/minute per IP. Guests sharing a public IP (such as venue Wi-Fi or a mobile carrier) share one quota. Make sure your reverse proxy forwards `X-Forwarded-For` so every guest does not appear to come from the proxy's IP. These limits are fixed (see [Configuration](/self-hosting/configuration/#fixed-limits)).

## Emails or passes link to localhost

The server is still using the default origin. Set `CORS_ORIGINS` to your public HTTPS URL (see [Which URL goes where](/self-hosting/domains-and-urls/)).

## Still stuck

Search existing [GitHub issues](https://github.com/karanshukla/openresto/issues). If you open a new issue, include your running versions (`docker compose images`), expected behavior, and relevant log excerpts with secrets removed.
