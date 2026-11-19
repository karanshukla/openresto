---
title: Push notifications (VAPID keys)
description: Generate VAPID keys, configure them, and fix the common reasons push stays off.
sidebar:
  order: 6
---

Web push notifications are optional. Without VAPID keys configured, OpenResto runs normally with push toggles hidden or disabled. With VAPID keys configured, you enable:

- **Admin notifications:** Subscribed browsers receive alerts for new bookings, cancellations, and capacity warnings.
- **Guest reminders and waitlist alerts:** Guests can opt in from booking and waitlist screens to receive booking reminders and "table ready" alerts.

## What VAPID is

Browsers route Web Push messages through vendor push services (Google, Mozilla, Apple). A VAPID key pair lets those services verify that messages originate from your server. You generate the pair once; no third-party account or fee is required.

| Variable            | Purpose                                                                          | Keep secret? |
| ------------------- | -------------------------------------------------------------------------------- | ------------ |
| `VAPID_PUBLIC_KEY`  | Shared with browsers when subscribing.                                           | No           |
| `VAPID_PRIVATE_KEY` | Signs outgoing push messages.                                                    | **Yes**      |
| `VAPID_SUBJECT`     | Contact identifier for push services (`mailto:you@example.com` or `https://` URL). | No           |

All three variables must be set; if any is empty, web push remains disabled.

## 1. Generate a key pair

On any machine with Node.js installed:

```bash
npx web-push generate-vapid-keys
```

This prints a public and private key without installing anything on your server.

## 2. Add them to `.env`

```dotenv
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

Recreate the backend container so it loads the new environment variables:

```bash
docker compose up -d
```

:::caution
Keep the same VAPID key pair after enabling push. Browser subscriptions are tied to the public key, so rotating keys requires every admin and guest to opt in again. Include `.env` in your backups.
:::

## 3. Enable notifications in the browser

Admins turn notifications on per browser under admin settings. Subscriptions apply to the browser across all locations, not to a single location. Guests see the opt-in toggle on booking confirmation and waitlist pages.

Browsers only allow Web Push over **HTTPS** (or `localhost`), so configure [HTTPS](/self-hosting/https/) first.

## What the toggle is telling you

| Admin settings card message     | Cause                                                       | Fix                                                                                           |
| ------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Push needs VAPID keys configured | One or more VAPID variables are missing on the server.      | Confirm all three variables are set in `.env` and run `docker compose up -d`.                 |
| Not supported in this browser   | Browser does not support Push API (including plain `http://`). | Serve the site over HTTPS and use a modern browser.                                           |
| Blocked by your browser         | Notification permission was previously denied.              | Re-enable notifications for the site in browser site settings, then reload.                   |

Browsers remember a denied permission prompt, so the app cannot re-prompt automatically.

## Reminder timing

By default, guest reminders are sent 24 hours and 2 hours before a booking. Customize this with `GUEST_PUSH_REMINDER_LEAD_HOURS` (for example, `48,24,2`). A reminder only sends if the guest opted in before that lead window opened, so booking less than 24 hours ahead does not immediately fire a 24-hour reminder.

## The native app is separate

The native guest app does not use VAPID keys. Its reminders go through Expo's push service without requiring certificates on your server. Only `EXPO_ACCESS_TOKEN` is needed, and only if your EAS project enables enhanced push security. See [Native app overview](/guides/native-app-overview/).
