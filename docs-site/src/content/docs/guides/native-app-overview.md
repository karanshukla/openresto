---
title: Native app overview
description: What you need, in what order, to publish your own branded guest app.
sidebar:
  order: 1
---

OpenResto ships a native guest app (iOS and Android) that you build and publish under your own
name. This page is the map. [Publishing the guest app](/guides/native-app/) has every command.

You don't need the native app to take bookings. The web app already works on phones, and guests
can install it from their browser. The native app is a good fit when you want a store listing,
Wallet passes or emails that open the app.

## What you need

| Need | Notes |
| ---- | ----- |
| A running, public HTTPS OpenResto | The app is built against your server address, see [Which URL goes where](/self-hosting/domains-and-urls/). |
| A clone of this repository at your server's release | The app and server must match, so check out the same tag. |
| Node.js and an [Expo](https://expo.dev) account | For EAS (Expo's build service) builds. |
| A Google Play developer account | For Android. |
| An Apple Developer Program membership | For iOS only. |

## Order of work

1. **Check the Native app page in the admin.** It lists what your server is missing before you
   start.
2. **Generate the config** with `native:init`, passing your public address and a bundle id you
   choose. The bundle id can't be changed once the app is published, so choose it with care.
3. **Create the EAS project** and note its id.
4. **Build an Android `.apk`** and try it on a real phone. You don't need a store account for this.
5. **Build the `.aab`** and upload it to Google Play.
6. **Optional, after the first build:** app links, so confirmation emails open the app, and
   Wallet passes.
7. **iOS** last, because it needs the Apple membership and an app review.

## What the server needs for each feature

| Feature | Server needs |
| ------- | ------------ |
| Booking in the app | Public HTTPS address only. |
| Store listing | A privacy policy URL, set in Admin, Settings, Brand. Both stores ask for it. |
| Booking reminders | Nothing on your server. They use Expo's push service. `EXPO_ACCESS_TOKEN` only if you enabled enhanced push security. |
| Emails that open the app | Two `.well-known` files that `native:init` generates, copied to your server after the first build. |
| Wallet passes | Apple and Google credentials, see the Wallet passes section of [Publishing the guest app](/guides/native-app/). |

Browser push, by contrast, uses [VAPID keys](/self-hosting/push-notifications/).

## Good to know

- **The server address is built into the app.** If you change domain, rebuild and resubmit the app.
- **The bundle id is fixed** after you publish.
- **Keep the app and server on the same version.** Update both when you [upgrade](/self-hosting/upgrading/).
- **Use an `https` address.** Plain `http` only works for `localhost`.

Details of each are in [Publishing the guest app](/guides/native-app/).
