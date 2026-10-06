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

Make an empty directory on your server and download `docker-compose.yml` from the
[latest release](https://github.com/karanshukla/openresto/releases/latest) into it:

```bash
mkdir openresto && cd openresto
curl -fsSLO https://github.com/karanshukla/openresto/releases/latest/download/docker-compose.yml
```

## 2. Create `.env`

Next to `docker-compose.yml`, create a file called `.env` with these values. The API won't start
without a valid `JWT_KEY` and `CORS_ORIGINS`, and the first start needs `ADMIN_EMAIL` and
`ADMIN_PASSWORD` to create your account.

```dotenv
# At least 32 characters, unique to this deployment: openssl rand -base64 48
JWT_KEY=...

# The public address people will type, with https:// and no trailing slash. No wildcards (*).
CORS_ORIGINS=https://bookings.example.com

# Your first Owner account. Only read while the database has no accounts.
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-unique-passphrase
```

Everything else is optional, and [Configuration](/self-hosting/configuration/) lists it all.
Keep `.env` private, since it holds your secrets.

:::caution[Don't copy `.env.example` for a Docker install]
The repository's `.env.example` is written for running the code from a clone, so some of its
names (`Vapid__PublicKey`, `Wallet__Apple__…`, `EmailSettings__…`) are not the ones the release
`docker-compose.yml` reads. Use the names on the [Configuration](/self-hosting/configuration/)
page instead.
:::

## 3. Start it

```bash
docker compose up -d
```

The first start takes a minute or so. The backend sets up its database first, and the reverse
proxy (the front door that sends visitors to the right place) waits until the backend and web
app report healthy.

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

| Storage        | Mounted at              | Holds                                           |
| -------------- | ----------------------- | ----------------------------------------------- |
| `db_data`      | `/data` in the backend  | The SQLite database and the Data Protection keys that encrypt your SMTP password |
| `media_data`   | `/app/wwwroot/media`    | Uploaded images and menu PDFs                   |
| `./wallet`     | `/wallet` in the backend, read-only | Optional Wallet pass certificates ([guide](/guides/native-app/#wallet-passes)) |
| `./well-known` | `/.well-known/` on your site, read-only | Optional app-link files for a native app ([guide](/guides/native-app/#4-make-confirmation-emails-open-the-app)) |

The two `./` folders sit next to `docker-compose.yml`. Docker creates them empty if they are
missing, and empty is fine.

Only the reverse proxy publishes a port. Change it with `HOST_PORT` in `.env`.

## Which version you are running

The `docker-compose.yml` attached to a release is **pinned to that release**: its image tags
are written out as, say, `2.4.0`. So the version you run is the version of the file you
downloaded, and it stays that way until you download a newer one. `docker compose pull` alone
won't move you to a newer release. See [Upgrading](/self-hosting/upgrading/).

If you would rather follow the newest release automatically, use
[`docker-compose.release.yml`](https://github.com/karanshukla/openresto/blob/main/docker-compose.release.yml)
from the repository instead, saved as `docker-compose.yml` so every command on these pages
works unchanged. It is the same file before pinning, so it runs `latest` unless you set
`OPENRESTO_VERSION` in `.env`:

```dotenv
OPENRESTO_VERSION=2.4.0
```

Images are tagged `X.Y.Z`, `X.Y` and `latest`, with no `v` in front.

## Next steps

1. [Put HTTPS in front of it](/self-hosting/https/).
2. [Set up email](/self-hosting/email/) so guests get confirmations.
3. [Schedule backups](/self-hosting/backup-restore/).
