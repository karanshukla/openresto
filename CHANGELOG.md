# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

N/A

## [1.1.0] - 2026-06-22

Hello! Thanks for reading the changelog, and for the 50 stars on Github! This project has taught me a ton and I've gathered a ton of feedback to try and polish it since the 1.0.0 release. This adds to 1.0.0 and cleans up some of the code for maintanability. If you're using the app in a real environment, please read through the changes below and let me know if you have any questions or run into any issues. Thanks again!

### Added

- **Booking Controls in Location Manager** — new "Booking Controls" section in the admin Location Manager panel for the selected location. Includes Pause/Resume new bookings for 60 minutes (with live "Paused until HH:MM" status) and Extend all active bookings by 60 minutes (with inline result count).
- **Location Manager redesign** — complete visual and UX overhaul of the admin Location Manager panel.
- **Restaurant photo in confirmation emails** — booking confirmation emails now display the restaurant's photo as a full-width banner header; falls back to the brand favicon icon tile, then a text-only header.
- **Shared email base template** — all outgoing emails now share a single `EmailTemplateBuilder` (card layout, footer with website URL and copyright). Admin custom emails sent from the booking page are also wrapped in the branded template.
- **"Opens in X hours/minutes" on home page** — restaurant cards show an "Opens in Xh Ym" label when the restaurant is currently closed but scheduled to open later today.
- **Configurable Website URL** — admins can set the public deployment URL from the Brand Identity settings panel. Used to generate correct absolute URLs in email links and header images. Falls back automatically to the `WEBSITE_URL` env var, then the first value in `CORS_ORIGINS`, then `localhost`. `WEBSITE_URL` is also exposed as a commented-out option in `docker-compose.release.yml` for self-hosters.

### Fixed

- **Active booking detection** — bookings without an `EndTime` now fall back to `booking.Date + 1 hour` as the end boundary instead of being treated as perpetually active.
- **Email confirmation deep link** — the "Manage your booking" button now links directly to `/booking-confirmation/{ref}?email={email}` so customers land on their booking without re-entering details.
- **Email header image URL** — relative `HeaderImageUrl` values are now resolved to absolute URLs using the configured website URL before being embedded in email HTML.
- **HSTS header** — `Strict-Transport-Security` is now enabled in the production nginx config (was accidentally commented out).
- **Multi-arch Docker build** — `dotnet publish` now runs on the native build platform rather than under QEMU emulation, matching the prior frontend fix and speeding up arm64 image builds.
- **Extend Bookings button state** — the button is now disabled and visually dimmed when there are no active bookings or results have already been applied; switching locations resets previous extend results.

## [1.0.0] - 2026-06-17

### Added

- **Multi-restaurant booking system** — customers browse restaurants, hold tables in real-time, and book instantly. No account required; bookings are identified by a short `BookingRef` code.
- **Admin dashboard** — manage reservations, tables, floor sections, booking pauses, and branding from a dedicated panel. Supports multiple restaurant locations per instance.
- **Real-time table holds** — 5-minute in-memory hold placed on a specific table when a customer selects a time slot. The `holdId` is required at booking time, preventing double-bookings during checkout.
- **IANA timezone-aware availability** — all `DateTime` values stored in UTC; restaurant-local open/close hours are computed via the restaurant's IANA timezone field.
- **Popular-times categorisation** — every 30-minute slot tagged `Lunch`, `Dinner`, or `Off-Peak` based on industry benchmarks; surfaced as labelled pill tabs in the frontend.
- **Booking pause** — admins can halt new reservations until a specific date/time without touching config files.
- **Full white-label branding** — app name, primary color, and favicon icon (10 Lucide icons) configurable from the admin settings panel. PWA identity (manifest name, theme color) updates live.
- **Dynamic PWA icons** — `/api/brand/pwa-icon.svg` and `/api/brand/pwa-icon-{192|512}.png` generated on-the-fly via Magick.NET (cross-platform, no native deps).
- **SMTP email notifications** via MailKit (optional — app degrades gracefully without SMTP config).
- **VAPID push notifications** (optional — app degrades gracefully without VAPID keys). Includes an admin notification inbox with swipe-to-delete (touch devices), pinned-item protection, bulk clear/delete actions, unread badge, and 30-second live polling. Capacity alerts fire when a restaurant reaches 80% of its table capacity.
- **Location manager as a dedicated nav section** — moved out of Settings into its own admin panel section with smooth accordion animations and persisted expanded state.
- **GDPR-compliant hard-delete** — admins can permanently purge individual booking records.
- **Encrypted recent-bookings cookie** — HttpOnly cookie via ASP.NET Data Protection; lets customers look up their recent reservations without an account.
- **OWASP ZAP API scan in CI** — every push runs a ZAP API scan against the full Docker stack using the OpenAPI spec (`/openapi/v1.json`) for endpoint discovery.
- **100% frontend test coverage target** — Jest + React Native Testing Library; Playwright E2E tests against the live Docker stack.
- **Multi-arch Docker images** (linux/amd64 + linux/arm64) published to GHCR on every tag push. Pi and NAS boxes supported out of the box.
- **Pinned release docker-compose.yml** — attached to every GitHub Release so self-hosters can `docker compose up` without cloning the repository.
- **Automatic EF Core migrations on startup** — the backend applies any pending schema migrations before accepting traffic. Upgrades from previous releases are safe and require no manual SQL.
- **SQLite backup and restore documentation** — see [`docs/backup-restore.md`](docs/backup-restore.md) for automated backup scripts and upgrade procedures.
- **Migration safety CI** — a dedicated GitHub Actions workflow validates that new EF Core migrations produce identical schemas whether applied to a fresh database or an existing one.

[Unreleased]: https://github.com/karanshukla/openresto/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/karanshukla/openresto/releases/tag/v1.0.0
[1.1.0]: https://github.com/karanshukla/openresto/releases/tag/v1.1.0
