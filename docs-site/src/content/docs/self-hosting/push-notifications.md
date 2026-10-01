---
title: Push notifications
description: Browser push for admins and guests using VAPID keys.
sidebar:
  order: 5
---

Push is optional. With no keys configured the app works normally and the push toggles stay
hidden. With keys, two things come alive:

- **Admin notifications**: a browser you have enabled gets a notification when a booking is made
  or cancelled.
- **Guest reminders and "table ready"**: guests can opt in from the booking screens, and the
  server sends reminders before their booking and a notice when a waitlist table is ready.

## 1. Generate a key pair

VAPID keys identify your server to browser push services. Generate them once:

```bash
npx web-push generate-vapid-keys
```

## 2. Put them in `.env`

```dotenv
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

Then `docker compose up -d`. Keep the private key secret and keep the pair stable: changing it
orphans every existing subscription, and people have to opt in again.

## 3. Turn it on in a browser

Admins enable notifications from the admin settings, per browser. A subscription belongs to the
browser, not to a location, so it receives every location's bookings.

Browsers only offer push on **HTTPS** (or `localhost`), so set up
[HTTPS](/self-hosting/https/) first.

## Reminder timing

Guest reminders go out at set lead times before a booking. The default is 24 hours and 2 hours.
Change it with `GUEST_PUSH_REMINDER_LEAD_HOURS`, for example `48,24,2`. A reminder is only sent
if the guest opted in before its lead time opened, so booking tomorrow's table never triggers a
"24 hours to go" push straight away.

The native app uses Expo's push service instead of VAPID. See
[Publishing the guest app](/guides/native-app/).
