---
title: Configuration reference
description: Every environment variable the backend and the compose stack read.
sidebar:
  order: 2
---

Settings are environment variables, normally set in the `.env` file next to
`docker-compose.yml`. The compose file maps them to the backend's own configuration names, so this page lists the
names you put in `.env`. SMTP is not one of them: it is configured in the admin, see
[Email](/self-hosting/email/).

After editing `.env`, apply it with `docker compose up -d`. Compose recreates only the containers
whose settings changed.

## Required

| Variable         | Description |
| ---------------- | ----------- |
| `JWT_KEY`        | Signing key for admin sessions. At least 32 characters, unique per deployment. Generate with `openssl rand -base64 48`. Changing it signs every admin out. |
| `CORS_ORIGINS`   | Comma-separated list of origins allowed to call the API, e.g. `https://bookings.example.com`. Wildcards are rejected. The default in the release compose is `http://localhost`. |
| `ADMIN_PASSWORD` | Password for the first Owner account. Only read while the database has no accounts; changing it later does nothing (see [Admin accounts](/self-hosting/admin-accounts/)). |

## Core

| Variable                  | Default                | Description |
| ------------------------- | ---------------------- | ----------- |
| `ADMIN_EMAIL`             | `admin@openresto.com`  | Email for the first Owner account. Same first-boot-only rule as the password. |
| `HOST_PORT`               | `80`                   | Port the reverse proxy listens on, on the host. |
| `OPENRESTO_VERSION`       | `latest`               | Image tag to run. |
| `WEBSITE_URL`             | derived from `CORS_ORIGINS` | Public address used in email links and images, if it differs from `CORS_ORIGINS`. Uncomment it in the compose file to use it. |
| `OPENRESTO_DEFAULT_LOCALE`| `en`                   | UI language served to new visitors: `en`, `fr`, `es` or `de`. Unset or unsupported falls back to `en`. |

The database path and Data Protection key directory (`/data/openresto.db`, `/data/dp-keys`) are
fixed by the compose file and live on the `db_data` volume. Leave them alone unless you are
changing where data is stored.

## Admin screen links

The API Keys screen links to the CLI package, the API guide and the source repository. They
default to the upstream project and are only worth overriding on a fork. Values that are not
`http(s)` URLs are ignored.

| Variable                    | Default |
| --------------------------- | ------- |
| `OPENRESTO_CLI_PACKAGE_URL` | npm page for `openresto-cli` |
| `OPENRESTO_API_DOCS_URL`    | The API guide on these docs |
| `OPENRESTO_REPOSITORY_URL`  | The GitHub repository |

## Push notifications

Leave empty to switch them off. See [Push notifications](/self-hosting/push-notifications/).

| Variable            | Description |
| ------------------- | ----------- |
| `VAPID_PUBLIC_KEY`  | Public half of the VAPID key pair. |
| `VAPID_PRIVATE_KEY` | Private half. Keep it secret. |
| `VAPID_SUBJECT`     | A `mailto:` address or URL identifying you to push services. |

## Guest reminders and native app

| Variable                             | Default | Description |
| ------------------------------------ | ------- | ----------- |
| `GUEST_PUSH_REMINDER_LEAD_HOURS`     | `24,2`  | Hours before a booking at which a reminder is sent. |
| `EXPO_ACCESS_TOKEN`                  | empty   | Only needed if your EAS project enabled enhanced push security. |

See [Publishing the guest app](/guides/native-app/) for the rest of the native setup.

## Wallet passes

Each button stays hidden while its issuer is unset. Mount the certificate files under `./wallet`
next to the compose file (it is mounted read-only at `/wallet`) and name them here. Setup is in
[Publishing the guest app](/guides/native-app/#wallet-passes).

| Variable                              | Description |
| ------------------------------------- | ----------- |
| `APPLE_PASS_TYPE_ID`                  | Apple Pass Type ID. |
| `APPLE_TEAM_ID`                       | Apple developer team ID. |
| `APPLE_PASS_CERTIFICATE_PATH`         | Path to the `.p12` pass certificate. |
| `APPLE_PASS_CERTIFICATE_PASSWORD`     | Password for that certificate. |
| `APPLE_WWDR_CERTIFICATE_PATH`         | Path to Apple's WWDR intermediate certificate. |
| `GOOGLE_WALLET_ISSUER_ID`             | Google Wallet issuer ID. |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_PATH` | Path to the service-account JSON key. |

## Running from a clone

When you run the API from source rather than Docker, the same settings can live in
`OpenRestoApi/appsettings.Local.json`, which the backend loads when present and `.gitignore`
keeps out of commits. Environment names map to configuration keys with `__` for nesting, for
example `Vapid__PublicKey` or `Jwt__Key`.
