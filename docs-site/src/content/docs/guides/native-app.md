---
title: Publishing the guest app
description: Every step and command to build, sign and publish your own branded iOS and Android guest app.
sidebar:
  order: 3
---

Your guests can browse locations, book a table and find their booking in a native iOS and
Android app, as well as on the web. Each restaurant publishes its own app, under its own name
and its own Apple and Google developer accounts, connected to its own OpenResto instance. That
keeps your branding, your guest support and your store reviews in your hands. OpenResto gives
you the setup: a generator that fills in the configuration from your instance, and this guide.

The admin dashboard stays on the web. On a phone, `/admin/*` takes the app back to the home
screen.

> **Start with Android.** A Play Console account is a one-off US$25 and review takes hours.
> Apple is US$99 a year and needs a Mac or EAS Build credits. Apple's App Review also looks
> closely at single-restaurant booking apps (guideline 4.2, "minimum functionality"). Ship
> Android first, then decide whether iOS is worth it for your guests. See
> [Before you submit to Apple](#before-you-submit-to-apple).

## Quick start

The whole Android path in one place. Each step is explained in the sections that follow.

```bash
# In a clone of this repository at the same release as your server
cd openresto-frontend
npm ci

# 1. Generate your configuration from your instance
npm run native:init -- --server https://bookings.example.com --bundle-id com.example.bistro

# 2. Create the EAS project and remember its id
npx eas-cli login
npx eas-cli init                                  # prints a project id
npm run native:init -- --project-id <that id>

# 3. Build an .apk to try on a phone, then an .aab for Play Console
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android

# 4. Make confirmation emails open the app (optional, after the first build)
npx eas-cli credentials --platform android      # shows the signing key's SHA-256 fingerprint
npm run native:init -- --android-fingerprint <fingerprint>
scp -r native/.well-known/ you@server:/path/to/openresto/well-known/
```

Then open **Admin → Settings → Native app** on your instance. It checks the things a store
submission or a deep link needs and tells you what is left to do.

## What the app adds

| Feature                 | Web / PWA                                                   | Native app                                                   |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Browse, book, look up   | ✅                                                          | ✅ same screens, same server                                 |
| Recent bookings         | encrypted cookie                                            | stored on the device                                         |
| Add to calendar         | download an `.ics`                                          | share sheet straight into the calendar app                   |
| Directions              | Google or Apple link                                        | one button, opening the maps app the phone has               |
| Share a booking         | copy the reference, or share a link via the browser's sheet | the share sheet, with the details and a link to the booking  |
| Refresh                 | reload the page                                             | pull down on Home and Locations                              |
| Confirmation email link | opens the browser                                           | opens the app (Universal Links / App Links, once configured) |
| Branding                | live from the server                                        | icon, name, colour and splash baked in at build time         |
| Booking reminders       | browser push (needs VAPID keys)                             | a push the day before and shortly before the table           |
| Table hold warning      | on-screen countdown only                                    | a local notification a minute before the hold lapses         |
| Wallet pass             | download / save link                                        | Add to Apple Wallet on iOS, Save to Google Wallet on Android |

The server address is fixed when the app is built, as it is for the web image. Each build
talks to one server. If you move servers, build the app again.

## Before you start

- A running OpenResto instance reachable over **https**. Universal Links and iOS transport
  security both need it, and the generator only accepts plain http for `localhost`.
- A brand icon chosen under **Admin → Settings → Brand**. The generator downloads both app
  icons from your instance. Without one, the build uses OpenResto's bundled artwork. You can
  also pass your own PNGs (see step 1).
- Node 24 and a clone of this repository at the **same release as your server**
  (`git clone --branch v2.4.0 https://github.com/karanshukla/openresto`, with your version).
  The app version is read from `openresto-frontend/package.json`, so a v2.4.0 checkout
  produces a 2.4.0 app.
- An [Expo account](https://expo.dev) for EAS Build. Cloud builds work from any machine;
  `eas build --local` works on Linux for Android and on a Mac for iOS.
- **Android:** a Google Play Console account. **iOS:** an Apple Developer Program membership.

## 1. Generate your configuration

```bash
cd openresto-frontend
npm ci
npm run native:init -- --server https://bookings.example.com --bundle-id com.example.bistro
```

The bundle id is the app's permanent identity on both stores, so pick it carefully and base it
on a domain you own. The command reads `/api/brand` from your instance and writes `openresto-frontend/native/`:

| File                                     | What it is                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `app.native.json`                        | name, colour, bundle id, Android package, URL scheme, deep-link host   |
| `icon-ios.png`                           | 1024×1024, opaque, square — the shape App Store Connect accepts        |
| `icon-android-foreground.png`            | 432×432 adaptive-icon foreground (white glyph, transparent background) |
| `.well-known/apple-app-site-association` | Universal Links, written once you pass `--apple-team-id`               |
| `.well-known/assetlinks.json`            | App Links, written once you pass `--android-fingerprint`               |

The directory is **gitignored on purpose**, because it holds your own identifiers and artwork.
EAS still uploads it, because `.easignore` mirrors `.gitignore` except for this directory.
Back it up alongside your `.env`.

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
- `--icon my-icon-1024.png` / `--android-foreground my-foreground-432.png` to use your own
  artwork instead of the generated glyph. A simple glyph on a flat colour is fine to start, but
  if you have a logo, your store listing will look better with it. The iOS icon must be 1024×1024 with **no
  transparency**. The Android foreground must be 432×432 with the artwork inside the centred
  264×264 safe zone, on a transparent background.

## 2. Build and test on Android

```bash
npx eas-cli login
npx eas-cli init                                 # prints a project id
npm run native:init -- --project-id <that id>    # remember it in app.native.json
npx eas-cli build --platform android --profile preview
```

`preview` produces an `.apk` you can install on a phone straight from the build page. Try the
whole flow against your instance: browse, book, open the confirmation, add it to your calendar,
and find the booking again under **My booking**.

## 3. Ship to Google Play

```bash
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android            # or upload the .aab in Play Console yourself
```

`eas.json` sets `appVersionSource: "remote"` with `autoIncrement`, so EAS manages
`versionCode` for you and it never appears in this repository. The visible version is the
OpenResto release you built from. Fill in the listing and submit. Both stores need a
**privacy policy URL** before a listing can be published. Set it under **Admin → Settings →
Brand**, in the Contact & Website card. The guest footer and the app's About screen link to it.

## 4. Make confirmation emails open the app

Booking confirmation emails link to
`https://bookings.example.com/booking-confirmation/<reference>?email=…`. For that link to open
the app instead of the browser, your server needs to show each platform that
you own both the app and the domain. You do this with two files served from `/.well-known/` on
your domain, each carrying identifiers that are yours.

**Android** needs the SHA-256 fingerprint of the certificate your app is signed with:

```bash
npx eas-cli credentials --platform android      # shows the keystore's SHA-256 fingerprint
npm run native:init -- --android-fingerprint <fingerprint>
```

Play App Signing re-signs your app by default. If that applies to you, use the fingerprint
from **Play Console → Setup → App signing** instead, or pass both. The flag can be repeated.

**iOS** needs your Apple Team ID (on the Apple Developer account's membership page):

```bash
npm run native:init -- --apple-team-id ABCDE12345
```

Then put the generated `.well-known/` directory on your server. The nginx image serves it from
a directory mounted next to your `docker-compose.yml`, so **no image is rebuilt**:

```bash
scp -r openresto-frontend/native/.well-known/ you@server:/path/to/openresto/well-known/
```

The release `docker-compose.yml` already mounts `./well-known` into the proxy. Check that both
files come back as JSON (the Apple one too, even though it has no extension) and without a
redirect, because neither verifier follows redirects:

```bash
curl -sI https://bookings.example.com/.well-known/apple-app-site-association | grep -i content-type
curl -s  https://bookings.example.com/.well-known/assetlinks.json
```

The Native app page in the admin runs the same two fetches and reports what it found.

Android verifies on install. iOS fetches through Apple's CDN, which can take a day to notice a
new file, so a delay is normal. The generated files open `/lookup`, `/booking-confirmation`,
`/locations`, `/restaurant`, `/book` and `/search` in the app. They leave out `/`, `/admin` and
`/api` on purpose, so the home page and the dashboard keep opening in a browser.

**Rebuild the app** after adding a team id or fingerprint. The Android intent filters and the
iOS associated-domains entitlement are part of the app itself.

## 5. iOS

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

EAS handles the provisioning profile and distribution certificate on your account. The build
declares `ITSAppUsesNonExemptEncryption = false`, so App Store Connect does not ask the export
compliance question on every upload.

### Before you submit to Apple

Before you spend the US$99, read guidelines **4.2** (minimum functionality), **4.2.6** (apps
created from a template or generation service) and **4.3** (spam and duplicates). Apple often
turns down a booking app for one restaurant that only does what its website does. It can also
turn down a white-label app built from a shared codebase, which is what 4.2.6 and 4.3 describe.
These things help an app get approved:

- **Offer things the website cannot.** Today that is the booking list kept on the device, the
  share-sheet calendar export, the hand-off to the maps app, booking reminders as push
  notifications and the Wallet pass. Set up the last two before you submit (see
  [Booking reminders](#booking-reminders) and [Wallet passes](#wallet-passes)). If the
  reviewer sees only what the website does, guideline 4.2 applies. If you are the first
  self-hoster to submit, you will find out whether this set is enough. Please report back.
- **Fill in the review notes.** Say it is the booking app for your restaurant and that it talks
  only to your own server. Give the reviewer a real reservation to look up.
- **Use your own artwork and name.** The generated glyph icon is fine for Android, but it can
  count against you in an Apple review.

This applies to any single-restaurant app, not just OpenResto. It is the step most likely to
take extra time, so it helps to plan for it.

## Booking reminders

A guest who opens a confirmed booking in the app sees **Remind me**. Pressing it asks the phone
for notification permission and registers that device against that one booking; the server
then pushes a reminder when each lead window opens, by default 24 hours and 2 hours before the
sitting (`GUEST_PUSH_REMINDER_LEAD_HOURS` in `.env`, comma-separated hours). Pressing it again opts the
device out. The reminder is written in the language the app was in when the guest opted in.

Nothing about the phone reaches your server except the Expo push token, and that token lives
only as long as the booking: it is deleted once the sitting has started or the booking is
cancelled, it goes with the booking when an admin purges it, and it is never shown in the
admin. Delivery goes through [Expo's push service](https://docs.expo.dev/push-notifications/overview/),
which holds the APNs and FCM credentials your EAS project set up during the first build, so
there is no Apple or Google push certificate to put on the server. If you enabled "enhanced
push security" on the EAS project, set `EXPO_ACCESS_TOKEN` in `.env` to the token it issued;
otherwise leave it empty.

The same toggle appears on the website when the server has
[VAPID keys](/self-hosting/push-notifications/) (the ones admin notifications use), delivered as a browser push through the service worker. A build running
in Expo Go or on a simulator has no push token to offer and hides the toggle.

The app also warns a guest one minute before a table hold lapses, so backgrounding it to check
a calendar does not silently cost them the table. That is a **local** notification the phone
schedules itself — nothing reaches your server and no push credentials are involved. It only
fires where notification permission has already been granted (the reminder toggle is the one
place that asks), and a guest who never granted it simply books without the warning.

## Wallet passes

A confirmed booking offers **Apple Wallet** on iOS and **Google Wallet** on Android (both on
the website), once you have set up the issuer. The pass carries the restaurant, date, time,
party size and reference, a QR code of the manage-booking link, your brand colour and icon,
and appears on the lock screen around the sitting. A cancelled booking gets no pass, since
Wallet would go on showing it. Each platform is optional and independent; leave one unset and
its button never appears.

The release `docker-compose.yml` mounts `./wallet` beside it into the backend at `/wallet`
read-only, so the files sit next to your `.env` and no image is rebuilt. A file that fails to
load is logged once at startup and that platform's button stays hidden; the Native app page's
readiness list says which issuer the server is signing under.

### Apple

Apple needs a Pass Type ID under your developer account and its certificate:

1. In the Apple Developer portal, register a Pass Type ID (e.g. `pass.com.example.bistro`) and
   create a certificate for it. Export it from Keychain Access as a `.p12` with a password.
2. Download Apple's WWDR intermediate certificate (G4 or later, `.cer`).
3. Put both files in the `wallet` folder next to `docker-compose.yml`, add these to `.env`,
   and run `docker compose up -d`:

   ```dotenv
   APPLE_PASS_TYPE_ID=pass.com.example.bistro
   APPLE_TEAM_ID=ABCDE12345
   APPLE_PASS_CERTIFICATE_PATH=/wallet/pass.p12
   APPLE_PASS_CERTIFICATE_PASSWORD=…
   APPLE_WWDR_CERTIFICATE_PATH=/wallet/wwdr.cer
   ```

   The paths start with `/wallet` because that is where the folder appears inside the
   container.

### Google

Google needs a Wallet issuer and a service account. They live in two different consoles, so
take the steps in order:

1. In the [Google Pay & Wallet Console](https://pay.google.com/business/console), create an
   issuer account and note the issuer ID (a ~19-digit number).
2. In the Google Cloud console, under **IAM & Admin → Service Accounts**, create a service
   account. It needs no project roles — click through to **Done**, then open it, go to
   **Keys → Add key → Create new key → JSON**, and keep the file that downloads.
3. Back in the Google Pay & Wallet Console, go to **Users → Invite a user**, paste the service
   account's email address, and set the access level to **Developer**. Without this step, your
   issuer does not recognise the key and every save link is rejected.
4. Put the key in the `wallet` folder next to `docker-compose.yml`, add these to `.env`,
   and run `docker compose up -d`:

   ```dotenv
   GOOGLE_WALLET_ISSUER_ID=3388000000012345678
   GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_PATH=/wallet/google-wallet.json
   ```

You do not need to create a pass class. The save link carries the class inline in its signed
JWT, so OpenResto does not call the Google Wallet API at all. Google only sees the link the
guest taps.

A new issuer starts in **demo mode**. The pass saves only for Google accounts listed as admins,
developers or test accounts on the issuer, and everyone else sees an error. That is how Google
sets new issuers up, so it does not mean something is misconfigured. Request production access
from the console when you are ready to publish. The sign-up is for the Wallet passes API, not
Google Pay, so it needs no merchant account, payment credentials or bank details.

### Trying it from a clone, without committing anything

Running from source, the settings use their configuration names (`Wallet__Google__IssuerId`
rather than `GOOGLE_WALLET_ISSUER_ID`). The simplest place for them is
`OpenRestoApi/appsettings.Local.json`. The backend loads it if present, and `.gitignore` keeps
it out of every commit:

```json
{
  "Wallet": {
    "Google": {
      "IssuerId": "3388000000012345678",
      "ServiceAccountKeyPath": "C:/Users/you/secrets/openresto-wallet.json"
    }
  }
}
```

Keep the key file itself outside the checkout; only its path belongs here. On Windows write the
path with forward slashes or doubled backslashes — a lone `\` is a JSON escape and the file
will not parse. Restart the backend afterwards: the file is read once at startup and the
credentials are cached for the process, so `dotnet watch` will not pick it up on its own.

To confirm the server loaded them, ask it what it can issue:

```bash
curl -s localhost:8080/api/brand      # → "wallet": { "apple": false, "google": true }
```

Both false means nothing is configured yet, so no button appears anywhere. That is the normal
state of a fresh clone. Two small things are expected when running locally: the pass has no
logo, because one is only attached when the site is reachable over https, and the QR code
points to a `localhost` manage link that another device cannot open. Set the brand's website
URL to your machine's LAN address if you want both to work from a phone.

## The admin's Native app page

**Admin → Settings → Native app** shows the server side of all of this. It is for whoever runs
the instance, who may or may not be the person building the app.

- **Store readiness** runs the checks a store submission or a deep link would fail on: the
  public address is https, a brand icon is chosen, a privacy policy URL is set, and the two
  `.well-known` files come back from your domain with the right content type and shape. Each
  failing row says what to do; re-check after you copy the files to the server. The two fetches
  go to the public address the server is configured with (the brand's website URL, else
  `WEBSITE_URL`, else the first `CORS_ORIGINS` entry) and are skipped, with the reason shown,
  when that address is `localhost` or a private-network address a store's verifier could not
  reach either. Two further rows report whether Apple and Google Wallet passes are being
  issued; those are optional and read as "not checked" rather than failures when unset.
- **Installed clients** lists which builds are talking to this server: platform, app version,
  last seen, requests in the last 7 and 30 days. The app identifies itself with an
  `X-OpenResto-Client: android/1.9.0` header on every request; the server keeps only daily
  counts per platform and version, no device identifiers or addresses, for 90 days.
- **Minimum supported app version** sets a floor. A build below it shows an update-required
  screen on launch instead of the app, which is how you retire a build that predates a change
  to the guest API. Leave it empty to accept any version.
- **Build your app** shows the `native:init` command pre-filled for this deployment.

## Keeping the app and server in step

A store update takes longer than `docker compose pull`. The app is built from a checkout at one
release and talks to whatever release your server is running. The two do not have to match
exactly, since the guest API changes rarely and only by adding things. Still, rebuild and
resubmit when you upgrade across a minor version, so guests get the guest-facing fixes. If an
upgrade does change the guest API, set the minimum supported app version on the Native app
page, and older builds will ask their users to update.

## Rate limits

Every guest request is rate limited per client IP address: 120 a minute for browsing and
booking, 10 a minute for looking up a booking. Phones on one carrier share a small pool of
addresses, so a full dining room on the same network can look like one very busy client. If the
app shows "too many requests" errors on busy nights, that is the likely cause. These limits are
built in and can't be changed from `.env`. First check that your proxy forwards
`X-Forwarded-For` (see [HTTPS](/self-hosting/https/)), and if guests still hit the limit,
[open an issue](https://github.com/karanshukla/openresto/issues).

## Reference

### Environment variables

All optional. Put the `.env` name in your `.env`; the release `docker-compose.yml` passes it to
the backend under the configuration name, which is what you use when running from a clone.

| Configuration name                      | `.env` name                              | Purpose                                                   |
| --------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| `GuestPush__ReminderLeadHours`          | `GUEST_PUSH_REMINDER_LEAD_HOURS`         | Reminder leads in hours, comma-separated (default `24,2`) |
| `GuestPush__ExpoAccessToken`            | `EXPO_ACCESS_TOKEN`                      | Only if the EAS project uses enhanced push security       |
| `Wallet__Apple__PassTypeIdentifier`     | `APPLE_PASS_TYPE_ID`                     | Pass Type ID, e.g. `pass.com.example.bistro`              |
| `Wallet__Apple__TeamIdentifier`         | `APPLE_TEAM_ID`                          | Apple Team ID                                             |
| `Wallet__Apple__CertificatePath`        | `APPLE_PASS_CERTIFICATE_PATH`            | Path to the `.p12`, under `/wallet`                       |
| `Wallet__Apple__CertificatePassword`    | `APPLE_PASS_CERTIFICATE_PASSWORD`        | The `.p12` password                                       |
| `Wallet__Apple__WwdrCertificatePath`    | `APPLE_WWDR_CERTIFICATE_PATH`            | Path to Apple's WWDR `.cer`, under `/wallet`              |
| `Wallet__Google__IssuerId`              | `GOOGLE_WALLET_ISSUER_ID`                | Wallet issuer ID                                          |
| `Wallet__Google__ServiceAccountKeyPath` | `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_PATH` | Path to the service-account JSON, under `/wallet`         |

### Files

| Path                                            | Committed | Purpose                                                           |
| ----------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `openresto-frontend/app.config.ts`              | yes       | reads `native/app.native.json` when present; unchanged without it |
| `openresto-frontend/eas.json`                   | yes       | build profiles, remote version source                             |
| `openresto-frontend/.easignore`                 | yes       | `.gitignore` minus `native/`, so EAS uploads your config          |
| `openresto-frontend/scripts/native-init.mjs`    | yes       | the generator                                                     |
| `openresto-frontend/native/`                    | **no**    | your identifiers, icons and `.well-known` files                   |
| `well-known/` next to your `docker-compose.yml` | **no**    | served by the nginx image at `/.well-known/`                      |
| `wallet/` next to your `docker-compose.yml`     | **no**    | mounted read-only into the backend at `/wallet`                   |

### Endpoints

- `GET /api/brand/app-icon-ios.png` and `GET /api/brand/app-icon-android-foreground.png` are
  what the generator downloads; both return 404 until a brand icon is chosen.
- `GET /api/brand` also carries `privacyPolicyUrl`, `minimumAppVersion`, `wallet` (which
  passes are offered) and `webPushPublicKey`.
- `GET /api/admin/native-app/status` (admin, `brand:read` for an API key) is what the Native
  app page renders.
- A booking's guest endpoints take the reference and the email, as lookup does:
  `POST`/`DELETE /api/bookings/ref/{ref}/reminders` register and remove one device, and
  `GET /api/bookings/ref/{ref}/wallet/apple.pkpass` and `/wallet/google` produce the passes.
  A push address is stored only if it is the shape the server will send to: an Expo push
  token, or an https Web Push endpoint on a public host.
