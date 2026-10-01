---
title: Email
description: Connect an SMTP account so guests get booking confirmations.
sidebar:
  order: 5
---

This page helps you send booking confirmation emails. OpenResto sends mail through any SMTP
account (the outgoing mail account from your email provider). Email is optional. Without it,
bookings still work and guests just don't get a confirmation email.

## Configure it in the admin

SMTP is set in the admin, not in `.env`. Go to **Settings → Email** and fill in:

| Field                  | Notes |
| ---------------------- | ----- |
| Host and port          | From your provider, e.g. `smtp.example.com` and `587`. |
| Username and password  | The password is stored encrypted in the database and not shown again. |
| Use SSL                | See below. |
| From name and address  | What guests see. Many providers need this to be an address you have verified. |
| Send booking confirmations | Off by default. Turn it on once the test passes. |

Press the test button before you rely on it: it saves the settings and tries to connect, so a wrong host or password shows up right away.

### Port and encryption

- **Port 587** always uses STARTTLS, whatever the SSL toggle says. Most providers use this.
- **Any other port** uses an implicit TLS connection (`465`) when **Use SSL** is on, and an
  unencrypted connection when it is off. Only turn SSL off for a relay on a network you trust.

## What gets sent

- Booking confirmations and cancellations to the guest, when confirmations are enabled.
- "Table ready" notices for the walk-in waitlist.

Emails link back to your site using your public address. It comes from `CORS_ORIGINS` unless you
set `WEBSITE_URL`. See [Configuration](/self-hosting/configuration/).

## If mail does not arrive

1. Re-run the test in **Settings → Email**.
2. Check the provider's own log. Common causes are a sender address the provider hasn't
   verified, or SPF/DKIM (settings that prove mail is really from your domain) not set up,
   which can send the mail to spam.
3. Look at the backend logs: `docker compose logs backend`.

:::note
`.env.example` and the compose file still list `EmailSettings__*` / `SMTP_*` variables. The
backend reads SMTP settings only from the database, so those variables don't do anything.
:::
