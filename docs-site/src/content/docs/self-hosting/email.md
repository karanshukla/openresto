---
title: Email
description: Connect an SMTP account so guests get booking confirmations.
sidebar:
  order: 5
---

OpenResto sends booking confirmation emails through any SMTP account. Email is optional; without SMTP configured, bookings still work normally without sending mail.

## Configure it in the admin

SMTP is configured in the admin UI rather than in `.env`. Open **Settings → Email** and fill in:

| Field                               | Notes                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Host and port                       | Provided by your mail host (for example, `smtp.example.com` and `587`).                                                |
| Username and password               | The password is stored encrypted in the database and is not displayed again.                                           |
| Use SSL                             | Controls TLS mode on non-587 ports (see below).                                                                        |
| From name and address               | Displayed to guests. Most SMTP providers require a verified sender address.                                            |
| Send booking confirmation emails    | Off by default. Enable after verifying your test email succeeds.                                                       |
| Email the restaurant about bookings | Off by default. Sends each location an email on new bookings and cancellations, alongside admin push notifications.    |

Click **Send a test email** to save the settings and test the SMTP connection immediately. The same screen includes a preview of the guest confirmation email and a log of recent delivery failures.

### Port and encryption

- **Port `587`:** Always uses STARTTLS regardless of the **Use SSL** toggle. Recommended for most providers.
- **Any other port:** Uses implicit TLS (such as port `465`) when **Use SSL** is enabled, and unencrypted SMTP when disabled. Only disable SSL for a local relay on a trusted network.

## What gets sent

- **Guest emails:** Booking confirmations and cancellation notices (when booking confirmation emails are enabled).
- **Restaurant alerts:** New-booking and cancellation alerts with a link to the booking in the admin (when restaurant alerts are enabled). Sent to the location's contact email, falling back to the brand contact email (**Settings → Brand** and each location's Contact card). Locations with neither receive no alerts.
- **Waitlist alerts:** "Table ready" notifications when staff call a walk-in waitlist guest who provided an email address.

Links inside emails use your resolved public URL: **Website URL** in brand settings, else `WEBSITE_URL`, else the first entry in `CORS_ORIGINS`. See [Which URL goes where](/self-hosting/domains-and-urls/).

## If mail does not arrive

1. Re-run **Send a test email** in **Settings → Email**.
2. Check your mail provider's logs for rejected senders, unverified `From` addresses, or missing SPF/DKIM records causing messages to land in spam.
3. Inspect the backend logs: `docker compose logs backend`.

:::note
`.env.example` and the compose files still reference `EmailSettings__*` / `SMTP_*` variables. The backend reads SMTP settings exclusively from the database, so those environment variables have no effect. Configure SMTP in the admin UI.
:::
