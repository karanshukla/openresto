---
title: Email
description: Connect an SMTP account so guests get booking confirmations.
sidebar:
  order: 5
---

OpenResto sends mail through any SMTP account you give it. Email is optional: with none
configured, bookings still work and guests simply get no confirmation email.

## Configure it in the admin

SMTP is set in the admin, not in `.env`. Go to **Settings → Email** and fill in:

| Field                  | Notes |
| ---------------------- | ----- |
| Host and port          | From your provider, e.g. `smtp.example.com` and `587`. |
| Username and password  | The password is stored encrypted in the database and never shown again. |
| Use SSL                | See below. |
| From name and address  | What guests see. Many providers require the address to be one you have verified. |
| Send booking confirmations | Off by default. Turn it on once the test passes. |

Press the test button before you rely on it: it saves the settings and connects to the server
with them, so a wrong host or password shows up straight away.

### Port and encryption

- **Port 587** always uses STARTTLS, regardless of the SSL toggle. This is what most providers
  want.
- **Any other port** uses an implicit TLS connection (`465`) when **Use SSL** is on, and an
  unencrypted connection when it is off. Only turn SSL off for a relay on a trusted network.

## What gets sent

- Booking confirmations and cancellations to the guest, when confirmations are enabled.
- "Table ready" notices for the walk-in waitlist.

Emails link back to your site using the public address, which comes from `CORS_ORIGINS` unless you
set `WEBSITE_URL`. See [Configuration](/self-hosting/configuration/).

## If mail does not arrive

1. Re-run the test in **Settings → Email**.
2. Check the provider's own log. Most failures are a sender address the provider has not
   verified, or SPF/DKIM that is not set up for your domain, which sends the mail to spam.
3. Look at the backend logs: `docker compose logs backend`.

:::note
`.env.example` and the compose file still list `EmailSettings__*` / `SMTP_*` variables. The
backend reads SMTP settings only from the database, so those variables have no effect.
:::
