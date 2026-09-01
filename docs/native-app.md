# Publishing the guest app to the stores yourself

OpenResto's guest surface (browse locations, book a table, find a booking) can be built as a
native iOS and Android app that **you** publish under **your own** Apple and Google developer
accounts, pointed at **your own** instance. There is no OpenResto app on the stores and there
never will be: a store listing carries a review cycle and a support burden that only the
person running the server can own. What the project ships is the configuration surface, a
generator that fills it in from your instance, and this guide.

The admin dashboard stays on the web. Staff run it on tablets, and everything a native admin
build would need (login issuance, uploads, push credentials) lives on that side. On a phone,
`/admin/*` simply sends the app back to the home screen.

> **Android first.** A Play Console account is a one-off US$25 and review takes hours. Apple
> is US$99 a year, needs a Mac or EAS Build credits, and a single-restaurant booking app is
> exactly the shape App Review's "minimum functionality" guideline (4.2) is written for. Ship
> Android, then decide whether iOS is worth it for your guests. See
> [Before you submit to Apple](#before-you-submit-to-apple).

## What you get

| Feature                 | Web / PWA            | Native app                                                   |
| ----------------------- | -------------------- | ------------------------------------------------------------ |
| Browse, book, look up   | ✅                   | ✅ same screens, same server                                 |
| Recent bookings         | encrypted cookie     | stored on the device                                         |
| Add to calendar         | download an `.ics`   | share sheet straight into the calendar app                   |
| Directions              | maps link            | opens the maps app                                           |
| Confirmation email link | opens the browser    | opens the app (Universal Links / App Links, once configured) |
| Branding                | live from the server | icon, name, colour and splash baked in at build time         |
| Push reminders, Wallet  | not yet              | not yet — tracked separately                                 |

The API base URL is a **build-time constant** in the native app, exactly as it is for the web
image. You build for one server. Change servers, rebuild.

## Prerequisites

- A running OpenResto instance reachable over **https** (Universal Links and iOS's transport
  security both require it; the generator refuses plain http except `localhost`).
- A brand icon chosen under **Admin → Settings → Brand**. The generator downloads the app icon
  and the Android adaptive-icon layer from your instance. Skip it and the build uses OpenResto's
  bundled artwork, or pass your own PNGs (see below).
- Node 24 and a clone of this repository at the **same release as your server**. The app version
  is read from `openresto-frontend/package.json`, so a v1.9.0 checkout produces a 1.9.0 app.
- An [Expo account](https://expo.dev) for EAS Build. Cloud builds are the easy path and work
  from any machine; `eas build --local` works on Linux for Android and on a Mac for iOS.
- **Android:** a Google Play Console account.
- **iOS:** an Apple Developer Program membership.

## 1. Generate your configuration

```bash
cd openresto-frontend
npm ci
npm run native:init -- --server https://bookings.example.com --bundle-id com.example.bistro
```

This reads `/api/brand` from your instance and writes everything into `openresto-frontend/native/`:

| File                                     | What it is                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `app.native.json`                        | name, colour, bundle id, Android package, URL scheme, deep-link host   |
| `icon-ios.png`                           | 1024×1024, opaque, square — the shape App Store Connect accepts        |
| `icon-android-foreground.png`            | 432×432 adaptive-icon foreground (white glyph, transparent background) |
| `.well-known/apple-app-site-association` | Universal Links, written once you pass `--apple-team-id`               |
| `.well-known/assetlinks.json`            | App Links, written once you pass `--android-fingerprint`               |

The directory is **gitignored on purpose**: it holds one publisher's identifiers and artwork,
and committing it would dirty every upstream merge. It is not ignored by EAS: `.easignore`
mirrors `.gitignore` except for this directory, so cloud builds receive it. Back it up with
your `.env`.

Re-running only needs the flags that change; everything else is remembered:

```bash
npm run native:init -- --project-id 1234abcd-…          # after `eas init`
npm run native:init -- --android-fingerprint AA:BB:…     # after your first Android build
npm run native:init -- --apple-team-id ABCDE12345         # when you go to iOS
```

Useful options (`npm run native:init -- --help` lists them all):

- `--package com.example.bistro.android` if the Android application id should differ from the
  iOS bundle id. Both default to the same value, which is the usual choice.
- `--name "Bistro Bookings"` to override the brand name as the app's display name.
- `--icon my-icon-1024.png` / `--android-foreground my-foreground-432.png` to use real artwork
  instead of the generated glyph. Fifteen Lucide glyphs on a flat colour is a thin identity for
  a store listing; if you have a logo, use it. The iOS icon must be 1024×1024 with **no
  transparency**. The Android foreground must be 432×432 with the artwork inside the centred
  264×264 safe zone, on a transparent background.

## 2. Create the EAS project and build for Android

```bash
npx eas-cli login
npx eas-cli init                                 # prints a project id
npm run native:init -- --project-id <that id>    # remember it in app.native.json
npx eas-cli build --platform android --profile preview
```

`preview` produces an `.apk` you can install on a phone straight from the build page. Test the
whole flow against your instance: browse, book, open the confirmation, add it to your calendar,
find the booking again under **Find my booking**.

When it works:

```bash
npx eas-cli build --platform android --profile production
```

That is an `.aab` for the Play Console. `eas.json` sets `appVersionSource: "remote"` with
`autoIncrement`, so EAS manages `versionCode` for you and it never appears in this repository;
the visible version tracks the OpenResto release you built from. Upload the `.aab` in Play
Console, fill in the listing, and submit. Or let EAS do the upload:

```bash
npx eas-cli submit --platform android
```

## 3. Make confirmation emails open the app

Booking confirmation emails link to `https://bookings.example.com/lookup?ref=…&email=…`. For
that link to open the app rather than the browser, your server has to prove to each platform
that you own both. That takes two files served from `/.well-known/` on your domain, and each
contains identifiers only you have.

**Android** needs the SHA-256 fingerprint of the certificate your app is signed with:

```bash
npx eas-cli credentials --platform android      # shows the keystore's SHA-256 fingerprint
npm run native:init -- --android-fingerprint <fingerprint>
```

If Play App Signing re-signs your app (it does by default), use the fingerprint from **Play
Console → Setup → App signing** instead, or pass both — the flag repeats.

**iOS** needs your Apple Team ID (shown in the Apple Developer account's membership page):

```bash
npm run native:init -- --apple-team-id ABCDE12345
```

Then put the generated `.well-known/` directory on your server. The nginx image serves it from
a directory mounted next to your `docker-compose.yml`, so **no image is rebuilt**:

```bash
scp -r openresto-frontend/native/.well-known/ you@server:/path/to/openresto/well-known/
```

The release `docker-compose.yml` already mounts `./well-known` into the proxy. Check the two
files come back as JSON, the Apple one included even though it has no extension:

```bash
curl -sI https://bookings.example.com/.well-known/apple-app-site-association | grep -i content-type
curl -s  https://bookings.example.com/.well-known/assetlinks.json
```

Android verifies on install; iOS fetches through Apple's CDN, which can take a day to notice a
new file. The generated files open `/lookup`, `/booking-confirmation`, `/locations`,
`/restaurant`, `/book` and `/search` in the app and deliberately exclude `/`, `/admin` and
`/api`, so the home page and the dashboard keep opening in a browser.

Rebuild the app after adding a team id or fingerprint: the Android intent filters and the
iOS associated-domains entitlement are part of the binary.

## 4. iOS

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

EAS handles the provisioning profile and distribution certificate on your account. The build
declares `ITSAppUsesNonExemptEncryption = false`, so App Store Connect does not ask the export
compliance question on every upload.

### Before you submit to Apple

Read guidelines **4.2** (minimum functionality), **4.2.6** (apps created from a template or
generation service) and **4.3** (spam and duplicates) before you spend the US$99. A booking app
for one restaurant that does what its website does is a common rejection, and a white-label app
built from a shared codebase is what 4.2.6 and 4.3 describe. What tends to carry an approval:

- The app should do things the website cannot. Today that is the device-held booking list,
  the share-sheet calendar export and the maps handoff. Push reminders and Wallet passes are
  the two that make the case decisively, and they are not built yet (see the issue this guide
  came from). If you are the first self-hoster to submit, you are the probe for whether the
  current set is enough; please report back.
- Fill in the review notes: say it is the booking app for your restaurant, that it talks only
  to your own server, and give the reviewer a real reservation to look up.
- Use your own artwork and name. The generated glyph icon is adequate for Android and a
  liability in an Apple review.

Nothing here is specific to OpenResto — it is what every single-venue app faces — but it is
the part of this process most likely to cost you time, so it is worth knowing before you start.

## The admin's Native app page

**Admin → Settings → Native app** is the server-side view of all of this, for the person who
runs the instance rather than the person building the binary (often the same person, but not
the same tools).

- **Readiness** runs the checks a store submission or a deep link would fail on: the public
  address is https, a brand icon is chosen, a privacy policy URL is set, and the two
  `.well-known` files come back from your domain with the right content type and shape. Each
  failing row says what to do. Re-check after you copy the files to the server.
- **Installed clients** lists which builds are talking to this server: platform, app version,
  last seen, requests in the last 7 and 30 days. The app identifies itself with an
  `X-OpenResto-Client: android/1.9.0` header on every request; the server keeps only daily
  counts per platform and version, no device identifiers or addresses, for 90 days.
- **Minimum supported app version** sets a floor. A build below it shows an update-required
  screen on launch instead of the app, which is how you retire a build that predates a change
  to the guest API. Leave it empty to accept any version.
- **Build your app** shows the `native:init` command pre-filled for this deployment.

The **privacy policy URL** itself lives on **Settings → Brand**, in the contact card. Both
stores require one before a listing can be published, and the guest footer links it on web
and in the app.

## Keeping the app and server in step

A store update is slower than `docker compose pull`. The app is built from a checkout at one
release and talks to whatever release your server is running; the two do not have to match
exactly, since the guest API changes rarely and additively, but rebuild and resubmit when you
upgrade across a minor version to pick up guest-facing fixes. When an upgrade does change the
guest API, set the minimum supported app version on the Native app page and the stale builds
will ask their users to update.

## Rate limits

Every guest request is rate limited per client IP (see `CORS_ORIGINS` and the limiter settings
in the backend). Phones on one carrier share a small pool of egress addresses, so a full dining
room of guests on the same network can look like one very busy client. If you see `429`s from
the app on busy nights, that is what is happening; raise the public limit in your backend
configuration.

## What is generated where

| Path                                            | Committed | Purpose                                                           |
| ----------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `openresto-frontend/app.config.ts`              | yes       | reads `native/app.native.json` when present; unchanged without it |
| `openresto-frontend/eas.json`                   | yes       | build profiles, remote version source                             |
| `openresto-frontend/.easignore`                 | yes       | `.gitignore` minus `native/`, so EAS uploads your config          |
| `openresto-frontend/scripts/native-init.mjs`    | yes       | the generator                                                     |
| `openresto-frontend/native/`                    | **no**    | your identifiers, icons and `.well-known` files                   |
| `well-known/` next to your `docker-compose.yml` | **no**    | served by the nginx image at `/.well-known/`                      |

Server-side, `GET /api/brand/app-icon-ios.png` and `GET /api/brand/app-icon-android-foreground.png`
are the public endpoints the generator downloads; they return 404 until a brand icon is chosen.
`GET /api/brand` also carries `privacyPolicyUrl` and `minimumAppVersion`, and
`GET /api/admin/native-app/status` (admin, `brand:read` for an API key) is what the Native app
page renders.
