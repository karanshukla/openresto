---
title: Configuration reference
description: Every environment variable the backend and the compose stack read.
sidebar:
  order: 2
---

OpenResto is configured through environment variables in the `.env` file next to `docker-compose.yml`. Email (SMTP) is the exception and is configured in the admin UI (see [Email](/self-hosting/email/)).

After editing `.env`, apply changes with `docker compose up -d`. Docker Compose recreates only the containers whose settings changed.

The variable names below are the `.env` names read by the release `docker-compose.yml`. The compose file maps them to backend configuration keys (for example, `VAPID_PUBLIC_KEY` maps to `Vapid__PublicKey`), which are the names used when [running from a clone](#running-from-a-clone).

## Required

| Variable         | Description |
| ---------------- | ----------- |
| `JWT_KEY`        | Signing key for admin sessions. Must be at least 32 characters and unique per deployment (generate with `openssl rand -base64 48`). Changing it signs out all active admins. |
| `CORS_ORIGINS`   | Comma-separated list of browser origins allowed to call the API (e.g., `https://bookings.example.com`). Wildcards (`*`) are rejected. Defaults to `http://localhost` in the release compose file. |
| `ADMIN_PASSWORD` | Password for the initial Owner account. Read only when the database has no accounts; editing it later has no effect (see [Admin accounts](/self-hosting/admin-accounts/)). |

## Core

| Variable                   | Default                       | Description |
| -------------------------- | ----------------------------- | ----------- |
| `ADMIN_EMAIL`              | `admin@openresto.com`         | Email for the initial Owner account. Read only on first boot when no accounts exist. |
| `HOST_PORT`                | `80`                          | Host port the reverse proxy listens on. |
| `OPENRESTO_VERSION`        | `latest`                      | Image tag to run. Read only by `docker-compose.release.yml`; the `docker-compose.yml` attached to a release pins its image tags (see [Installation](/self-hosting/installation/#which-version-you-are-running)). |
| `WEBSITE_URL`              | First entry of `CORS_ORIGINS` | Public URL used in email links, Wallet passes, and native app checks when different from `CORS_ORIGINS`. Uncomment its line in `docker-compose.yml` to use it. See [Which URL goes where](/self-hosting/domains-and-urls/). |
| `OPENRESTO_DEFAULT_LOCALE` | `en`                          | Default UI language for new visitors (`en`, `fr`, `es`, or `de`; falls back to `en` if unset or unsupported). Uncomment its line in `docker-compose.yml` to use it. |

The database path (`/data/openresto.db`) and Data Protection key directory (`/data/dp-keys`) are fixed by the compose file on the `db_data` volume. Leave them unchanged unless relocating storage.

## Admin screen links

The API Keys screen links to the CLI package, API guide, and source repository. These default to the upstream OpenResto project and only need to be changed on a fork. Uncomment their lines in `docker-compose.yml` to enable them. Non-`http(s)` values are ignored.

| Variable                    | Default                      |
| --------------------------- | ---------------------------- |
| `OPENRESTO_CLI_PACKAGE_URL` | npm page for `openresto-cli` |
| `OPENRESTO_API_DOCS_URL`    | The API guide on these docs  |
| `OPENRESTO_REPOSITORY_URL`  | The GitHub repository        |

## Push notifications

Leave these empty to keep web push disabled. See [Push notifications](/self-hosting/push-notifications/).

| Variable            | Description |
| ------------------- | ----------- |
| `VAPID_PUBLIC_KEY`  | Public half of the VAPID key pair shared with subscribing browsers. |
| `VAPID_PRIVATE_KEY` | Private half of the VAPID key pair. Keep secret. |
| `VAPID_SUBJECT`     | `mailto:` address or `https://` URL identifying your server to push services. |

## Guest reminders and native app

| Variable                         | Default | Description |
| -------------------------------- | ------- | ----------- |
| `GUEST_PUSH_REMINDER_LEAD_HOURS` | `24,2`  | Comma-separated hours before a booking when reminders are sent. |
| `EXPO_ACCESS_TOKEN`              | empty   | Needed only if your EAS project has enhanced push security enabled. |

See [Publishing the guest app](/guides/native-app/) for the full native setup.

## Wallet passes

Each Wallet button remains hidden until its settings are configured. Place certificate files in `./wallet` next to `docker-compose.yml` (mounted read-only at `/wallet`) and configure these variables. See [Wallet passes](/guides/native-app/#wallet-passes) for issuer setup.

| Variable                                 | Description |
| ---------------------------------------- | ----------- |
| `APPLE_PASS_TYPE_ID`                     | Apple Pass Type ID. |
| `APPLE_TEAM_ID`                          | Apple Developer Team ID. |
| `APPLE_PASS_CERTIFICATE_PATH`            | Path to the `.p12` pass certificate inside the container. |
| `APPLE_PASS_CERTIFICATE_PASSWORD`        | Password for the `.p12` certificate. |
| `APPLE_WWDR_CERTIFICATE_PATH`            | Path to Apple's WWDR intermediate certificate inside the container. |
| `GOOGLE_WALLET_ISSUER_ID`                | Google Wallet issuer ID. |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_PATH` | Path to the service-account JSON key inside the container. |

## Fixed limits

These limits are built into the backend and cannot be changed via `.env`:

| Limit                                                                     | Value                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------- |
| Overall requests per visitor IP                                           | 300/minute                                            |
| Public guest pages (browsing, availability, booking)                      | 120/minute per IP                                     |
| Reference lookups (lookup, cancel, reminders, waitlist tickets)           | 10/minute per IP                                      |
| Admin sign-in attempts                                                    | 10/minute per IP                                      |
| API key requests                                                          | 1000/minute per IP                                    |
| Table holds                                                               | 5 minutes each, max 5 concurrent holds per IP         |
| Uploads                                                                   | Hero image 5 MB, location photo 2 MB, menu PDF 10 MB  |

## Running from a clone

When running the API directly from source instead of Docker, start from `.env.example` or put local overrides in `OpenRestoApi/appsettings.Local.json` (loaded automatically when present and ignored by `.gitignore`). Environment variable names use `__` for nested configuration keys (for example, `Vapid__PublicKey` or `Jwt__Key`).
