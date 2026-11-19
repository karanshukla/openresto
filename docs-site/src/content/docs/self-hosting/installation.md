---
title: Install with Docker
description: Run OpenResto from the pre-built images with Docker Compose.
sidebar:
  order: 1
---

OpenResto ships as three pre-built multi-arch images (`linux/amd64` and `linux/arm64`) on GHCR: the API, the web frontend, and an nginx reverse proxy. No external database or storage service is needed. All persistent data lives in two Docker volumes, so a small VPS, NAS, or Raspberry Pi is enough.

## Requirements

- Docker with the Compose plugin (`docker compose version`)
- A server reachable on a port (`80` by default); for public deployments, add a domain name and HTTPS (see [HTTPS and reverse proxies](/self-hosting/https/))
- Optional: an SMTP account for booking confirmation emails

## 1. Download `docker-compose.yml`

Create a directory on your server and download `docker-compose.yml` from the [latest release](https://github.com/karanshukla/openresto/releases/latest):

```bash
mkdir openresto && cd openresto
curl -fsSLO https://github.com/karanshukla/openresto/releases/latest/download/docker-compose.yml
```

## 2. Create `.env`

Create a `.env` file next to `docker-compose.yml`. The API requires a valid `JWT_KEY` and `CORS_ORIGINS` to start, and uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first boot to create the initial Owner account.

```dotenv
# At least 32 characters, unique to this deployment: openssl rand -base64 48
JWT_KEY=...

# Public address with https:// and no trailing slash. Wildcards (*) are not allowed.
CORS_ORIGINS=https://bookings.example.com

# Initial Owner account. Read only while the database has no accounts.
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-unique-passphrase
```

All other variables are optional (see [Configuration](/self-hosting/configuration/)). Keep `.env` private because it contains your secrets.

:::caution[Don't copy `.env.example` for a Docker install]
The repository's `.env.example` is for running from source, so some keys (`Vapid__PublicKey`, `Wallet__Apple__…`, `EmailSettings__…`) do not match the names read by the release `docker-compose.yml`. Use the variable names documented on the [Configuration](/self-hosting/configuration/) page instead.
:::

## 3. Start the stack

```bash
docker compose up -d
```

The first startup takes about a minute while the backend initializes SQLite and applies migrations. `reverse-proxy` starts once both `backend` and `frontend` report healthy.

```bash
docker compose ps          # backend, frontend, and reverse-proxy should be running
curl -f http://localhost/api/health
```

Open `http://your-server` and sign in at `/admin` with the email and password from `.env`. Traffic is plain HTTP until you configure HTTPS.

If the health check fails, wait a minute and retry, then check `docker compose logs backend`.

## What the stack contains

| Service         | Image                                    | Role                                                                                                |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `backend`       | `ghcr.io/karanshukla/openresto-backend`  | ASP.NET Core API and SQLite database                                                                |
| `frontend`      | `ghcr.io/karanshukla/openresto-frontend` | Web app served on an internal port                                                                  |
| `reverse-proxy` | `ghcr.io/karanshukla/openresto-nginx`    | Public entry point: routes `/api` to backend, everything else to frontend, and serves uploaded media |

| Storage        | Mounted at                              | Contents                                                                                                                  |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `db_data`      | `/data` in `backend`                    | SQLite database and Data Protection keys (used to encrypt your SMTP password)                                             |
| `media_data`   | `/app/wwwroot/media`                    | Uploaded images and menu PDFs                                                                                             |
| `./wallet`     | `/wallet` in `backend` (read-only)      | Optional Wallet pass certificates ([guide](/guides/native-app/#wallet-passes))                                            |
| `./well-known` | `/.well-known/` on your site (read-only) | Optional app-link files for a native app ([guide](/guides/native-app/#4-make-confirmation-emails-open-the-app))            |

Docker creates `./wallet` and `./well-known` as empty directories next to `docker-compose.yml` if they do not exist, which is expected when those features are unused.

Only `reverse-proxy` exposes a host port (configurable via `HOST_PORT` in `.env`).

## Which version you are running

The `docker-compose.yml` attached to a GitHub release is **pinned to that release** (for example, tag `2.4.0`), so `docker compose pull` alone will not upgrade you to a newer version. See [Upgrading](/self-hosting/upgrading/) when you are ready to move to a new release.

To track releases via an environment variable instead, download [`docker-compose.release.yml`](https://github.com/karanshukla/openresto/blob/main/docker-compose.release.yml) from the repository and save it as `docker-compose.yml`. It defaults to `latest` unless you set `OPENRESTO_VERSION` in `.env`:

```dotenv
OPENRESTO_VERSION=2.4.0
```

Container images are tagged `X.Y.Z`, `X.Y`, and `latest` (without a leading `v`).

## Next steps

1. [Set up HTTPS](/self-hosting/https/)
2. [Configure email](/self-hosting/email/) for guest confirmations
3. [Schedule backups](/self-hosting/backup-restore/)
