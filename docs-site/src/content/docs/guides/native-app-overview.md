---
title: Native app overview
description: What you need, in what order, to publish your own branded guest app.
sidebar:
  order: 1
---

OpenResto ships a native guest app (iOS and Android) that you build and publish under your own
name. This page is the map; [Publishing the guest app](/guides/native-app/) has every command.

You do not need the native app to take bookings. The web app already works on phones, and guests
can also install it from the browser. Publish the native app when you want a store listing,
Wallet passes or app-link emails.

## What you need

| Need | Notes |
| ---- | ----- |
| A running, public HTTPS OpenResto | The app is built against your server address, see [Which URL goes where](/self-hosting/domains-and-urls/). |
| A clone of this repository at your server's release | The app and server must match, so check out the same tag. |
| Node.js and an [Expo](https://expo.dev) account | For EAS builds. |
| A Google Play developer account | For Android. |
| An Apple Developer Program membership | For iOS only. |

## Order of work

1. **Check the Native app page in the admin.** It lists what your server is missing before you
   start.
2. **Generate the config** with `native:init`, passing your public address and a bundle id you
   choose. The bundle id is permanent once published, so pick it deliberately.
3. **Create the EAS project** and note its id.
4. **Build an Android `.apk`** and try it on a real phone. This needs no store account.
5. **Build the `.aab`** and upload it to Google Play.
6. **Optional, after the first build:** app links, so confirmation emails open the app, and
   Wallet passes.
7. **iOS** last, because it needs the Apple membership and review.

## What the server needs for each feature

| Feature | Server needs |
| ------- | ------------ |
| Booking in the app | Public HTTPS address only. |
| Store listing | A privacy policy URL, set in Admin, Settings, Brand. Both stores require it. |
| Booking reminders | Nothing on your server, they use Expo's push service. `EXPO_ACCESS_TOKEN` only if you enabled enhanced push security. |
| Emails that open the app | Two `.well-known` files that `native:init` generates, copied to your server after the first build. |
| Wallet passes | Apple and Google credentials, see the Wallet passes section of [Publishing the guest app](/guides/native-app/). |

Browser push, by contrast, uses [VAPID keys](/self-hosting/push-notifications/).

## Things that catch people out

- **The server address is fixed in the build.** Changing domain means rebuilding and resubmitting.
- **The bundle id cannot change** after you publish.
- **Keep the app and server in step.** Update both when you [upgrade](/self-hosting/upgrading/).
- **`http` addresses are rejected** except for `localhost`.

Details of each are in [Publishing the guest app](/guides/native-app/).
