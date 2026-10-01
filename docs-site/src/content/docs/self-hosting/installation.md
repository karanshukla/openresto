---
title: Install with Docker
description: Run OpenResto from the pre-built images with Docker Compose.
sidebar:
  order: 1
---

This page gets OpenResto running on your own server with Docker Compose.

OpenResto comes as three pre-built images (`linux/amd64` and `linux/arm64`) on GHCR: the API,
the web app and an nginx that sits in front of both. You don't need a separate database or
storage service. Everything is kept in two Docker volumes, so a Raspberry Pi, a NAS or a small
VPS is enough.

## Requirements

- Docker with the Compose plugin (`docker compose version` should work).
- A server you can reach on a port (80 by default). For a public site you will also want a domain
  name and HTTPS, covered in [HTTPS and reverse proxies](/self-hosting/https/).
- Optional: an SMTP account if you want booking confirmation emails.

## 1. Get the files

Download `docker-compose.yml` from the
[latest release](https://github.com/karanshukla/openresto/releases/latest) into an empty
directory on your server, and grab
[`.env.example`](https://github.com/karanshukla/openresto/blob/main/.env.example) next to it.

```bash
mkdir openresto && cd openresto
# save docker-compose.yml from the release page here
curl -fsSLo .env https://raw.githubusercontent.com/karanshukla/openresto/main/.env.example
```

## 2. Fill in `.env`

Three values are needed. The API won't start without a valid `JWT_KEY` and `CORS_ORIGINS`, and
the first start needs an `ADMIN_PASSWORD` to create your account.

```dotenv
# At least 32 characters, unique to this deployment: openssl rand -base64 48
JWT_KEY=...

# The public address people will type, with https:// and no trailing slash. No wildcards (*).
CORS_ORIGINS=https://bookings.example.com

# Seeds the first Owner account. Only read while the database has no accounts.
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-unique-passphrase
```

Everything else is optional. Please keep `.env` private, since it holds your secrets. See [Configuration](/self-hosting/configuration/) for the full list.

## 3. Start it

```bash
docker compose up -d
```

The first start takes a short while. The backend updates its database first, and the reverse
proxy (the front door that sends visitors to the right place) waits until the backend and web
app are ready.

```bash
docker compose ps          # backend, frontend and reverse-proxy should be running
curl -f http://localhost/api/health
```

Open `http://your-server` and sign in at `/admin` with the email and password from `.env`.
The site uses plain HTTP until you add HTTPS (TLS, the lock icon in the browser).

If the health check fails, wait a minute and try again, then look at `docker compose logs backend`.

## What the stack contains

| Service         | Image                                     | Role                                                    |
| --------------- | ----------------------------------------- | ------------------------------------------------------- |
| `backend`       | `ghcr.io/karanshukla/openresto-backend`   | ASP.NET Core API and SQLite database                    |
| `frontend`      | `ghcr.io/karanshukla/openresto-frontend`  | The web app, served on an internal port                 |
| `reverse-proxy` | `ghcr.io/karanshukla/openresto-nginx`     | Public entry point: `/api` to the backend, the rest to the web app, uploaded media served directly |

| Volume       | Mounted at              | Holds                                           |
| ------------ | ----------------------- | ----------------------------------------------- |
| `db_data`    | `/data` in the backend  | The SQLite database and Data Protection keys    |
| `media_data` | `/app/wwwroot/media`    | Uploaded images and menu PDFs                   |

Only the reverse proxy publishes a port. Change it with `HOST_PORT` in `.env`.

## Pinning a version

`latest` follows the newest release. To stay on one version, set it on every command, or in
`.env`:

```bash
OPENRESTO_VERSION=2.3.1 docker compose up -d
```

Image tags are published as `X.Y.Z`, `X.Y` and `latest`. See [Upgrading](/self-hosting/upgrading/)
before you move between versions.

## Next steps

1. [Put HTTPS in front of it](/self-hosting/https/).
2. [Set up email](/self-hosting/email/) so guests get confirmations.
3. [Schedule backups](/self-hosting/backup-restore/).
