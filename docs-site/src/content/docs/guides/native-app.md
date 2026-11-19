---
title: Publishing the guest app
description: Every step and command to build, sign and publish your own branded iOS and Android guest app.
sidebar:
  order: 3
---

Guests can browse locations, book tables, and look up reservations in a native iOS and Android app in addition to the web. Each restaurant builds and publishes its own app under its own name and Apple/Google developer accounts, pointed at its own OpenResto server. This keeps branding, support, and store reviews under your control. OpenResto provides a configuration generator (`native:init`) that pulls branding from your server.

The admin dashboard remains web-only. Opening `/admin/*` inside the native app redirects back to the home screen.

> **Start with Android.** Google Play Console is a one-time US$25 fee and review usually takes hours. Apple charges US$99/year, requires a Mac or EAS Build credits, and scrutinizes single-restaurant booking apps under guideline 4.2 ("minimum functionality"). Ship Android first, then evaluate iOS (see [Before you submit to Apple](#before-you-submit-to-apple)).

## Quick start

The complete Android workflow at a glance (each step is detailed below):

```bash
# In a clone of this repository at the same release as your server
cd openresto-frontend
npm ci

# 1. Generate configuration from your instance
npm run native:init -- --server https://bookings.example.com --bundle-id com.example.bistro

# 2. Create the EAS project and save its ID
npx eas-cli login
npx eas-cli init                                  # prints a project ID
npm run native:init -- --project-id <that id>

# 3. Build an .apk to test on a phone, then an .aab for Play Console
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android

# 4. Make confirmation emails open the app (optional, after the first build)
npx eas-cli credentials --platform android      # prints the signing key's SHA-256 fingerprint
npm run native:init -- --android-fingerprint <fingerprint>
scp -r native/.well-known/ you@server:/path/to/openresto/well-known/
```

Open **Admin → Settings → Native app** on your instance to run automated checks for store readiness and deep links.

## What the app adds

| Feature                 | Web / PWA                                                   | Native app                                                   |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Browse, book, look up   | ✅                                                          | ✅ Same screens, same server                                 |
| Recent bookings         | Encrypted cookie                                            | Stored locally on the device                                 |
| Add to calendar         | Download `.ics` file                                        | Native share sheet straight into the calendar app            |
| Directions              | Google or Apple Maps link                                   | Single button opening the device's maps app                  |
| Share a booking         | Copy reference or share via browser sheet                   | Native share sheet with details and booking link             |
| Refresh                 | Reload the page                                             | Pull-to-refresh on Home and Locations                        |
| Confirmation email link | Opens in browser                                            | Opens in app (Universal Links / App Links once configured)   |
| Branding                | Loaded live from server                                     | Icon, name, colour, and splash bundled at build time         |
| Booking reminders       | Browser push (requires VAPID keys)                          | Push notification the day before and shortly before seating  |
| Table hold warning      | On-screen countdown only                                    | Local notification 1 minute before the hold expires          |
| Wallet pass             | Download / save link                                        | Add to Apple Wallet (iOS) / Save to Google Wallet (Android)  |

Each build is bound to one server URL. If you change domains later, you must rebuild and resubmit the app.

## Before you start

- **Public HTTPS server:** Universal Links and iOS App Transport Security require `https`. The generator only permits plain `http` for `localhost`.
- **Brand icon:** Pick an icon under **Admin → Settings → Brand** so the generator can download both app icons from your server. Without one, OpenResto's default artwork is used, or you can pass custom PNGs in step 1.
- **Node 24 and matching repo checkout:** Clone the repository at the same release tag as your server (`git clone --branch v2.4.0 https://github.com/karanshukla/openresto`). The app version comes from `openresto-frontend/package.json`, so a `v2.4.0` checkout produces version `2.4.0`.
- **[Expo account](https://expo.dev):** Required for EAS Build. Cloud builds run from any OS; `eas build --local` works on Linux for Android and macOS for iOS.
- **Developer accounts:** Google Play Console for Android; Apple Developer Program membership for iOS.

## 1. Generate your configuration

```bash
cd openresto-frontend
npm ci
npm run native:init -- --server https://bookings.example.com --bundle-id com.example.bistro
```

Choose the bundle ID carefully (typically reverse-DNS based on a domain you own), as it is permanent on both app stores. `native:init` fetches `/api/brand` from your server and writes to `openresto-frontend/native/`:

| File                                     | Purpose                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `app.native.json`                        | Name, colour, bundle ID, Android package, URL scheme, deep-link host   |
| `icon-ios.png`                           | 1024×1024 opaque square PNG for App Store Connect                      |
| `icon-android-foreground.png`            | 432×432 adaptive-icon foreground (white glyph, transparent background) |
| `.well-known/apple-app-site-association` | iOS Universal Links file (written once `--apple-team-id` is provided)  |
| `.well-known/assetlinks.json`            | Android App Links file (written once `--android-fingerprint` is provided) |

`openresto-frontend/native/` is gitignored so your identifiers and artwork are never committed, while `.easignore` mirrors `.gitignore` except for `native/` so EAS still uploads it. Back up this folder alongside your `.env`.

Re-running `native:init` preserves previous values, so you only need to pass newly added flags:

```bash
npm run native:init -- --project-id 1234abcd-…          # after `eas init`
npm run native:init -- --android-fingerprint AA:BB:…     # after your first Android build
npm run native:init -- --apple-team-id ABCDE12345         # when setting up iOS
```

Common flags (run `npm run native:init -- --help` for the full list):

- `--package com.example.bistro.android`: Set a separate Android application ID (defaults to the `--bundle-id` value).
- `--name "Bistro Bookings"`: Override the brand name as the app's display name.
- `--icon my-icon-1024.png` / `--android-foreground my-foreground-432.png`: Provide custom artwork instead of the generated glyph. The iOS icon must be 1024×1024 with **no transparency**. The Android foreground must be 432×432 on a transparent background with artwork inside the centered 264×264 safe zone.

## 2. Build and test on Android

```bash
npx eas-cli login
npx eas-cli init                                 # prints a project ID
npm run native:init -- --project-id <that id>    # saves it to app.native.json
npx eas-cli build --platform android --profile preview
```

The `preview` profile produces an `.apk` you can install directly on a phone from the EAS build page. Verify the full guest flow against your instance: browse locations, create a booking, view confirmation, export to calendar, and look up the booking under **My booking**.

## 3. Ship to Google Play

```bash
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android            # or upload the .aab manually in Play Console
```

`eas.json` sets `appVersionSource: "remote"` with `autoIncrement`, so EAS tracks Android `versionCode` remotely rather than in Git. The visible app version matches the OpenResto release you checked out.

Both app stores require a **privacy policy URL** before publication. Configure it under **Admin → Settings → Brand** in the **Contact & Website** card; both the guest web footer and the app's About screen link to it.

## 4. Make confirmation emails open the app

Confirmation emails link to `https://bookings.example.com/booking-confirmation/<reference>?email=…`. For those links to open in the app instead of the browser, your domain must serve verification files under `/.well-known/` proving you own both the domain and the app.

### Generate the verification files

- **Android** requires the SHA-256 fingerprint of your signing certificate:

  ```bash
  npx eas-cli credentials --platform android      # displays the keystore's SHA-256 fingerprint
  npm run native:init -- --android-fingerprint <fingerprint>
  ```

  If Google Play App Signing re-signs your app (enabled by default), use the SHA-256 fingerprint from **Play Console → Setup → App signing**, or pass `--android-fingerprint` multiple times to include both.

- **iOS** requires your Apple Team ID (found on your Apple Developer account's membership page):

  ```bash
  npm run native:init -- --apple-team-id ABCDE12345
  ```

### Deploy the files to your server

Copy `native/.well-known/` to the `well-known/` folder next to your `docker-compose.yml`. The release compose file mounts `./well-known` into nginx, so no image rebuild is needed:

```bash
scp -r openresto-frontend/native/.well-known/ you@server:/path/to/openresto/well-known/
```

Verify both files return JSON directly with no HTTP redirect (neither Apple nor Android follows redirects during verification):

```bash
curl -sI https://bookings.example.com/.well-known/apple-app-site-association | grep -i content-type
curl -s  https://bookings.example.com/.well-known/assetlinks.json
```

The admin **Native app** page runs the same checks automatically.

Android verifies App Links at install time. iOS fetches the association file through Apple's CDN, which can take up to a day to update. The generated rules open `/lookup`, `/booking-confirmation`, `/locations`, `/restaurant`, `/book`, and `/search` in the app, while deliberately excluding `/`, `/admin`, and `/api` so the main site and admin dashboard stay in the browser.

**Rebuild the app** after adding a Team ID or fingerprint: Android intent filters and the iOS associated-domains entitlement are compiled into the binary.

## 5. iOS

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

EAS manages provisioning profiles and distribution certificates under your Apple account. The build sets `ITSAppUsesNonExemptEncryption = false` so App Store Connect skips the export compliance prompt on uploads.

### Before you submit to Apple

Before paying the US$99 annual fee, review Apple App Review Guidelines **4.2** (minimum functionality), **4.2.6** (apps created from a template or generation service), and **4.3** (spam and duplicates). Apple frequently rejects single-restaurant booking apps that only mirror a website or share a white-label codebase.

To improve your chances of approval:

- **Enable native-only features before submitting:** Native features include on-device booking history, native calendar share sheet, maps hand-off, push booking reminders, and Wallet passes. Configure [Booking reminders](#booking-reminders) and [Wallet passes](#wallet-passes) before submitting so the reviewer sees clear functionality beyond a web wrapper. If you are among the first self-hosters submitting to Apple, feedback on review outcomes is welcome.
- **Write clear review notes:** Explain that the app is your restaurant's official booking app connected solely to your own server, and provide a test reservation reference the reviewer can look up.
- **Use custom branding and artwork:** The generated glyph works for Android, but custom logo artwork helps avoid template rejections during Apple review.

## Booking reminders

Confirmed bookings in the app display a **Remind me** toggle. Enabling it requests notification permission and registers the device for that booking only. By default, reminders are sent 24 hours and 2 hours before the sitting (configure via `GUEST_PUSH_REMINDER_LEAD_HOURS` in `.env` as comma-separated hours). Toggling it off unregisters the device. Reminders use the language active in the app when the guest opted in.

### Privacy and delivery

- Only the Expo push token is sent to your server. It is deleted once the sitting starts, if the booking is cancelled, or if an admin purges the booking, and it is never exposed in the admin UI.
- Notifications are sent through [Expo's push service](https://docs.expo.dev/push-notifications/overview/), which uses the APNs and FCM credentials configured on your EAS project, so no Apple or Google push keys are needed on your server. Set `EXPO_ACCESS_TOKEN` in `.env` only if you enabled "enhanced push security" on your EAS project.
- On the website, the same toggle appears when [VAPID keys](/self-hosting/push-notifications/) are configured and delivers via browser push. Expo Go and simulators hide the toggle because they do not provide push tokens.

### Table hold expiration warning

The native app schedules a **local** notification 1 minute before a table hold expires so guests switching apps to check their calendar do not lose their table. It runs entirely on the device with no server involvement and only fires if notification permission has already been granted via the reminder toggle.

## Wallet passes

Confirmed bookings offer **Apple Wallet** on iOS and **Google Wallet** on Android (both are also offered on the web) once issuer credentials are configured. Passes show the restaurant, date, time, party size, booking reference, a QR code linking to the manage-booking page, and your brand colour and icon, and appear on the lock screen near the booking time. Cancelled bookings do not offer passes.

Apple and Google Wallet are independent and optional: leaving either unconfigured hides its button.

The release `docker-compose.yml` mounts `./wallet` read-only at `/wallet` inside the backend container, so no image rebuild is needed. Startup logs record any credential file that fails to load and hide that platform's button; **Admin → Settings → Native app** reports which issuers are active.

### Apple

1. In the Apple Developer portal, register a Pass Type ID (for example, `pass.com.example.bistro`) and create a signing certificate for it. Export the certificate and key from Keychain Access as a password-protected `.p12` file.
2. Download Apple's WWDR intermediate certificate (G4 or later, `.cer`).
3. Place both files in the `wallet/` folder next to `docker-compose.yml`, add these variables to `.env`, and run `docker compose up -d`:

   ```dotenv
   APPLE_PASS_TYPE_ID=pass.com.example.bistro
   APPLE_TEAM_ID=ABCDE12345
   APPLE_PASS_CERTIFICATE_PATH=/wallet/pass.p12
   APPLE_PASS_CERTIFICATE_PASSWORD=…
   APPLE_WWDR_CERTIFICATE_PATH=/wallet/wwdr.cer
   ```

   Paths start with `/wallet` because `./wallet` is mounted at `/wallet` inside the container.

### Google

Google Wallet setup spans two consoles. Follow these steps in order:

1. In the [Google Pay & Wallet Console](https://pay.google.com/business/console), create an issuer account and copy the issuer ID (~19 digits).
2. In the Google Cloud Console, go to **IAM & Admin → Service Accounts** and create a service account. No IAM project roles are required. Open the new account, go to **Keys → Add key → Create new key → JSON**, and download the key file.
3. Back in the Google Pay & Wallet Console, go to **Users → Invite a user**, enter the service account's email address, and assign the **Developer** role. Without this step, save links are rejected because the issuer does not authorize the key.
4. Place the JSON key in `wallet/` next to `docker-compose.yml`, add these variables to `.env`, and run `docker compose up -d`:

   ```dotenv
   GOOGLE_WALLET_ISSUER_ID=3388000000012345678
   GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_PATH=/wallet/google-wallet.json
   ```

No pass class needs to be pre-created in the console: OpenResto embeds the class inline in the signed JWT save link and never calls the Google Wallet API directly.

New Google Wallet issuers start in **demo mode**, where only Google accounts listed as admins, developers, or test accounts on the issuer can save passes (other users receive an error). Request production access in the console before launch. This uses the Wallet Passes API only, so no merchant account, payment details, or bank information is required.

### Testing Wallet passes from a local clone

When running from source, use configuration key names (`Wallet__Google__IssuerId` instead of `GOOGLE_WALLET_ISSUER_ID`), or add them to `OpenRestoApi/appsettings.Local.json` (loaded automatically when present and excluded by `.gitignore`):

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

Keep the key file outside the repository. On Windows, use forward slashes or escaped backslashes (`\\`) so the JSON remains valid. Restart the backend after editing: credentials are read once at startup and cached, so `dotnet watch` will not reload them automatically.

Verify which issuers loaded:

```bash
curl -s localhost:8080/api/brand      # → "wallet": { "apple": false, "google": true }
```

When running locally over plain HTTP, passes omit the brand logo (logos require HTTPS) and QR codes point to `localhost` unless you set the brand's Website URL to your machine's LAN address.

## The admin's Native app page

**Admin → Settings → Native app** displays server-side status for your mobile builds:

- **Store readiness:** Verifies that the public URL uses HTTPS, a brand icon is selected, a privacy policy URL is set, and both `.well-known` files return the expected content type and structure. Fetches target the server's resolved public URL (brand Website URL → `WEBSITE_URL` → first `CORS_ORIGINS` entry) and are skipped with an explanation if the address is `localhost` or on a private network. Optional Apple and Google Wallet rows report issuer status without failing readiness when unset.
- **Installed clients:** Displays active client builds by platform, version, last seen, and 7-day/30-day request counts. Native builds send `X-OpenResto-Client: android/1.9.0` on every request; the server stores only aggregated daily counts per platform and version (no device IDs or IPs) for 90 days.
- **Minimum supported app version:** Blocks older builds with an update-required screen on launch. Leave empty to allow any version.
- **Build your app:** Shows a pre-filled `native:init` command for your instance.

## Keeping the app and server in step

App store updates take longer than `docker compose pull`. Because the guest API changes infrequently and generally only adds fields, minor version skew usually works. Still, rebuild and resubmit when upgrading across minor versions so guests receive fixes. If a server upgrade introduces a breaking guest API change, set **Minimum supported app version** on the Native app page to prompt older clients to update.

## Rate limits

Guest requests are rate-limited per client IP: 120 requests/minute for browsing and booking, and 10 requests/minute for reference lookups. Mobile devices on the same carrier or venue Wi-Fi often share a public IP, which can trigger `"too many requests"` errors on busy nights.

These limits are built in and not configurable via `.env`. First confirm your reverse proxy forwards `X-Forwarded-For` (see [HTTPS](/self-hosting/https/)); if guests still hit limits, [open an issue](https://github.com/karanshukla/openresto/issues).

## Reference

### Environment variables

All variables are optional. Use the `.env` name in your Docker `.env` file, or the configuration name when running from source.

| Configuration name                      | `.env` name                              | Purpose                                                   |
| --------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| `GuestPush__ReminderLeadHours`          | `GUEST_PUSH_REMINDER_LEAD_HOURS`         | Reminder leads in hours, comma-separated (default `24,2`) |
| `GuestPush__ExpoAccessToken`            | `EXPO_ACCESS_TOKEN`                      | Only if the EAS project uses enhanced push security       |
| `Wallet__Apple__PassTypeIdentifier`     | `APPLE_PASS_TYPE_ID`                     | Pass Type ID, e.g. `pass.com.example.bistro`              |
| `Wallet__Apple__TeamIdentifier`         | `APPLE_TEAM_ID`                          | Apple Team ID                                             |
| `Wallet__Apple__CertificatePath`        | `APPLE_PASS_CERTIFICATE_PATH`            | Path to the `.p12` under `/wallet`                        |
| `Wallet__Apple__CertificatePassword`    | `APPLE_PASS_CERTIFICATE_PASSWORD`        | Password for the `.p12` certificate                       |
| `Wallet__Apple__WwdrCertificatePath`    | `APPLE_WWDR_CERTIFICATE_PATH`            | Path to Apple's WWDR `.cer` under `/wallet`               |
| `Wallet__Google__IssuerId`              | `GOOGLE_WALLET_ISSUER_ID`                | Google Wallet issuer ID                                   |
| `Wallet__Google__ServiceAccountKeyPath` | `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_PATH` | Path to the service-account JSON under `/wallet`          |

### Files

| Path                                            | Committed | Purpose                                                                 |
| ----------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `openresto-frontend/app.config.ts`              | Yes       | Reads `native/app.native.json` when present; unchanged without it       |
| `openresto-frontend/eas.json`                   | Yes       | EAS build profiles and remote version source                            |
| `openresto-frontend/.easignore`                 | Yes       | Mirrors `.gitignore` minus `native/`, so EAS uploads your config        |
| `openresto-frontend/scripts/native-init.mjs`    | Yes       | Native config and asset generator                                       |
| `openresto-frontend/native/`                    | **No**    | Generated identifiers, icons, and `.well-known` files                   |
| `well-known/` next to your `docker-compose.yml` | **No**    | Served by nginx at `/.well-known/`                                      |
| `wallet/` next to your `docker-compose.yml`     | **No**    | Mounted read-only into the backend at `/wallet`                         |

### Endpoints

- `GET /api/brand/app-icon-ios.png` and `GET /api/brand/app-icon-android-foreground.png`: Icons downloaded by `native:init` (return `404` until a brand icon is selected).
- `GET /api/brand`: Includes `privacyPolicyUrl`, `minimumAppVersion`, `wallet` (enabled pass platforms), and `webPushPublicKey`.
- `GET /api/admin/native-app/status`: Admin readiness endpoint (requires `brand:read` when called with an API key).
- Guest booking endpoints (authenticated by booking reference and email):
  - `POST` / `DELETE /api/bookings/ref/{ref}/reminders`: Register or remove a reminder device. Push addresses are accepted only if they match an Expo push token or an `https` Web Push endpoint on a public host.
  - `GET /api/bookings/ref/{ref}/wallet/apple.pkpass` and `/wallet/google`: Generate Apple and Google Wallet passes.
