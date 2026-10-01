---
title: Push notifications (VAPID keys)
description: Generate VAPID keys, configure them, and fix the common reasons push stays off.
sidebar:
  order: 6
---

Push is optional. With no keys configured the app works normally and the push toggles stay
hidden or disabled. With keys, two things come alive:

- **Admin notifications**: a browser you have enabled gets a notification for new bookings,
  cancellations and capacity alerts.
- **Guest reminders and "table ready"**: guests can opt in from the booking screens, and the
  server sends reminders before their booking and a notice when a waitlist table is ready.

## What VAPID is

Browsers deliver push through their vendor's service (Google, Mozilla, Apple). VAPID is the key
pair that lets those services confirm a message really comes from your server. You make the pair
once; there is no account to create and nothing to pay for.

| Value | What it is | Keep secret? |
| ----- | ---------- | ------------ |
| `VAPID_PUBLIC_KEY` | Shared with browsers when they subscribe. | No |
| `VAPID_PRIVATE_KEY` | Signs each message. | **Yes** |
| `VAPID_SUBJECT` | A contact for the push services, as `mailto:you@example.com` or an `https://` URL. | No |

All three are required. If any one is empty, push counts as not configured.

## 1. Generate a key pair

Anywhere with Node installed:

```bash
npx web-push generate-vapid-keys
```

It prints a public and a private key. You do not need to install anything on the server.

## 2. Put them in `.env`

```dotenv
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

Then recreate the backend so it reads them:

```bash
docker compose up -d
```

:::caution
Keep the pair stable. Browsers subscribe against the public key, so replacing it orphans every
existing subscription and everyone has to opt in again. Include the keys in your backups of
`.env`.
:::

## 3. Turn it on in a browser

Admins enable notifications from the admin settings, per browser. A subscription belongs to the
browser, not to a location, so it receives every location's bookings. Guests are offered the
opt-in on the booking screens.

Browsers only offer push on **HTTPS** (or `localhost`), so set up
[HTTPS](/self-hosting/https/) first.

## What the toggle is telling you

| What the admin settings card says | Meaning | Fix |
| --------------------------------- | ------- | --- |
| Push needs VAPID keys configured | The server has no complete key set. | Check all three values are in `.env` and that you ran `docker compose up -d` after editing. |
| Not supported in this browser | The browser has no service worker or Push API, which includes plain `http://` pages. | Use HTTPS and a current browser. |
| Blocked by your browser | Notification permission was refused earlier. | Allow notifications for the site in the browser's site settings, then reload. |

Browsers remember a refusal, so the app cannot ask again for you.

## Reminder timing

Guest reminders go out at set lead times before a booking. The default is 24 hours and 2 hours.
Change it with `GUEST_PUSH_REMINDER_LEAD_HOURS`, for example `48,24,2`. A reminder is only sent
if the guest opted in before its lead time opened, so booking tomorrow's table never triggers a
"24 hours to go" push straight away.

## The native app is separate

The native guest app does not use VAPID. Its reminders go through Expo's push service, which
needs no certificates on your server. The only setting is `EXPO_ACCESS_TOKEN`, and only if your
EAS project turned on enhanced push security. See
[Native app overview](/guides/native-app-overview/).
