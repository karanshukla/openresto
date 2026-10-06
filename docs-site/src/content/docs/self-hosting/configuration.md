---
title: Configuration reference
description: Every environment variable the backend and the compose stack read.
sidebar:
  order: 2
---

This page lists the settings you can change. They are environment variables (named values the
server reads when it starts), normally kept in the `.env` file next to `docker-compose.yml`.
Email (SMTP) is the exception. You set it in the admin, see [Email](/self-hosting/email/).

After editing `.env`, apply it with `docker compose up -d`. Compose restarts only the containers
whose settings changed.

The names on this page are the ones the release `docker-compose.yml` reads from `.env`. The
compose file passes each one to the backend under its configuration name (for example
`VAPID_PUBLIC_KEY` becomes `Vapid__PublicKey`), which is the name you would use when
[running from a clone](#running-from-a-clone).

## Required

You need to set these three.

| Variable         | Description |
| ---------------- | ----------- |
| `JWT_KEY`        | Signing key for admin sessions. At least 32 characters, unique per deployment. Generate with `openssl rand -base64 48`. Changing it signs every admin out. |
| `CORS_ORIGINS`   | Comma-separated list of origins allowed to call the API, e.g. `https://bookings.example.com`. Wildcards (`*`) aren't accepted. The default in the release compose is `http://localhost`. |
| `ADMIN_PASSWORD` | Password for the first Owner account. Only read while the database has no accounts, so changing it later has no effect (see [Admin accounts](/self-hosting/admin-accounts/)). |

## Core

| Variable                  | Default                | Description |
| ------------------------- | ---------------------- | ----------- |
| `ADMIN_EMAIL`             | `admin@openresto.com`  | Email for the first Owner account. Same first-boot-only rule as the password. |
| `HOST_PORT`               | `80`                   | Port the reverse proxy listens on, on the host. |
| `OPENRESTO_VERSION`       | `latest`               | Image tag to run. Only read by `docker-compose.release.yml`; the file attached to a release is already pinned (see [Installation](/self-hosting/installation/#which-version-you-are-running)). |
| `WEBSITE_URL`             | first entry of `CORS_ORIGINS` | Public address used in email links, Wallet passes and the native app checks, if it differs from `CORS_ORIGINS`. Uncomment its line in the compose file to use it. See [Which URL goes where](/self-hosting/domains-and-urls/). |
| `OPENRESTO_DEFAULT_LOCALE`| `en`                   | UI language served to new visitors: `en`, `fr`, `es` or `de`. If unset or unsupported, it uses `en`. Uncomment its line in the compose file to use it. |

The database path and Data Protection key directory (`/data/openresto.db`, `/data/dp-keys`) are
fixed by the compose file and live on the `db_data` volume. Please leave them as they are unless you are
moving where data is stored.

## Admin screen links

The API Keys screen links to the CLI package, the API guide and the source repository. They
default to the upstream project, so you only need to change them on a fork. Uncomment their
lines in the compose file to use them. Values that are not `http(s)` URLs are ignored.

| Variable                    | Default |
| --------------------------- | ------- |
| `OPENRESTO_CLI_PACKAGE_URL` | npm page for `openresto-cli` |
| `OPENRESTO_API_DOCS_URL`    | The API guide on these docs |
| `OPENRESTO_REPOSITORY_URL`  | The GitHub repository |

## Push notifications

Leave these empty to keep push off. See [Push notifications](/self-hosting/push-notifications/).

| Variable            | Description |
| ------------------- | ----------- |
| `VAPID_PUBLIC_KEY`  | Public half of the VAPID key pair (the keys that let browsers trust your notifications). |
| `VAPID_PRIVATE_KEY` | Private half. Please keep it secret. |
| `VAPID_SUBJECT`     | A `mailto:` address or URL identifying you to push services. |

## Guest reminders and native app

| Variable                             | Default | Description |
| ------------------------------------ | ------- | ----------- |
| `GUEST_PUSH_REMINDER_LEAD_HOURS`     | `24,2`  | Hours before a booking at which a reminder is sent. |
| `EXPO_ACCESS_TOKEN`                  | empty   | Only needed if your EAS project enabled enhanced push security. |

See [Publishing the guest app](/guides/native-app/) for the rest of the native setup.

## Wallet passes

Each Wallet button stays hidden until its settings are filled in. Mount the certificate files under `./wallet`
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

## Fixed limits

A few limits are built in and can't be changed from `.env`:

| Limit | Value |
| ----- | ----- |
| Requests per visitor IP address, overall | 300 a minute |
| Public guest pages (browsing, availability, booking) | 120 a minute per IP |
| Booking lookups by reference (lookup, cancel, reminders, waitlist tickets) | 10 a minute per IP |
| Sign-in attempts | 10 a minute per IP |
| Requests made with an API key | 1000 a minute per IP |
| Table holds | 5 minutes each, at most 5 at once per IP |
| Uploads | Hero image 5 MB, location photo 2 MB, menu PDF 10 MB |

## Running from a clone

If you run the API from source instead of Docker, `.env.example` is the starting point, and
the same settings can also live in `OpenRestoApi/appsettings.Local.json`, which the backend
loads when present and `.gitignore` keeps out of commits. Environment names map to
configuration keys with `__` for nesting, for example `Vapid__PublicKey` or `Jwt__Key`.
