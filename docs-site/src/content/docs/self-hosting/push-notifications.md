---
title: Push notifications (VAPID keys)
description: Generate VAPID keys, configure them, and fix the common reasons push stays off.
sidebar:
  order: 6
---

This page helps you turn on push notifications, the pop-up alerts a browser can show. Push is
optional. Without keys, the app works normally and the push toggles stay hidden or disabled.
With keys, you get:

- **Admin notifications**: a browser you've enabled gets a notification for new bookings,
  cancellations and capacity alerts.
- **Guest reminders and "table ready"**: guests can opt in from the booking screens, and the
  server sends reminders before their booking and a notice when a waitlist table is ready.

## What VAPID is

Browsers deliver push through their maker's service (Google, Mozilla, Apple). VAPID is a pair of
keys that lets those services confirm a message really comes from your server. You make the pair
once. There's no account to create and nothing to pay for.

| Value | What it is | Keep secret? |
| ----- | ---------- | ------------ |
| `VAPID_PUBLIC_KEY` | Shared with browsers when they subscribe. | No |
| `VAPID_PRIVATE_KEY` | Signs each message. | **Yes** |
| `VAPID_SUBJECT` | A contact for the push services, as `mailto:you@example.com` or an `https://` URL. | No |

You need all three. If any one is empty, push stays off.

## 1. Generate a key pair

Anywhere with Node installed:

```bash
npx web-push generate-vapid-keys
```

It prints a public and a private key. You don't need to install anything on the server.

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
Please keep the same pair once you start. Browsers sign up using the public key, so if you
replace it, everyone has to opt in again. Include the keys when you back up `.env`.
:::

## 3. Turn it on in a browser

Admins enable notifications from the admin settings, per browser. A subscription belongs to the
browser, not to a location, so it receives every location's bookings. Guests are offered the
opt-in on the booking screens.

Browsers only offer push on **HTTPS** (or `localhost`), so please set up
[HTTPS](/self-hosting/https/) first.

## What the toggle is telling you

| What the admin settings card says | Meaning | Fix |
| --------------------------------- | ------- | --- |
| Push needs VAPID keys configured | The server has no complete key set. | Check all three values are in `.env` and that you ran `docker compose up -d` after editing. |
| Not supported in this browser | The browser can't do push. This includes plain `http://` pages. | Use HTTPS and a current browser. |
| Blocked by your browser | Notifications were declined earlier. | Allow notifications for the site in the browser's site settings, then reload. |

Browsers remember a refusal, so the app can't ask again for you.

## Reminder timing

Guest reminders go out a set time before a booking. The default is 24 hours and 2 hours.
Change it with `GUEST_PUSH_REMINDER_LEAD_HOURS`, for example `48,24,2`. A reminder is only sent
if the guest opted in before its time opened, so booking tomorrow's table won't trigger a
"24 hours to go" push straight away.

## The native app is separate

The native guest app doesn't use VAPID. Its reminders go through Expo's push service, which
needs no certificates on your server. The only setting is `EXPO_ACCESS_TOKEN`, and only if your
EAS project turned on enhanced push security. See
[Native app overview](/guides/native-app-overview/).
