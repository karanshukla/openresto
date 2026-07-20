# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-07-20

Hello! This release includes the Booking page rework with lots of new features! As always, let me know if you run into any issues!

### Added

- **Navigation redesign** (#196, #205, #211, #240) — merged Locations list + detail/booking page (replacing the standalone `/book/:id` page), full weekly opening hours shown on the customer restaurant view, a burger/overflow menu replacing the light/dark toggle, and a static Help popup with a visible entry point for keyboard shortcuts and the restaurant's social links.
- **"Any section" auto-assign** (#243, #248) — "Any section" is now the default choice in the booking form; the server picks the best available table across all sections at submit time instead of the client pre-selecting one, closing a race where two concurrent "any" submissions could grab the same table.
- **Decoupled booking slot interval** (#245, #247) — a new restaurant-level start-time interval setting (15/30/60 min, default 30) independent of `DefaultBookingDurationMinutes`, so e.g. 90-minute bookings can still start on a 15-minute grid instead of being locked to the half hour.
- **MaxTableOversizeSeats setting** (#244, #249) — restaurants can cap how much larger than the party size an auto-assigned table is allowed to be, so a party of 2 no longer gets seated at an idle 6-top by default.
- **Menu PDF upload** (#246, #250) — admins can upload and host a PDF menu directly from location settings instead of only linking to an externally hosted one.

### Fixed

- **Admin routes unreachable at `/locations`** — the new customer-facing Locations page silently collided with the existing admin sections/tables manager at the same URL; admin routes now live under `/admin/*`.
- **Locations list card polish** (#241) — consistent expand/collapse chevron, tapping "Book / details" now scrolls to the form even when the card was already open, and the blurb/menu link show while the card is collapsed.
- **Overflow menu position on wide viewports** — the menu panel now anchors to the trigger button's real on-screen position instead of a fixed offset from the window edge.

### Changed

- Added a CODEOWNERS file so PRs automatically request review.

## [1.3.1] - 2026-07-17

A couple minor tweaks that I neede to fix after yesterday's release!

- Updated the styling in the Admin Bookings page and fixed the column widths in the header row.
- The Location description was added in the BE but not in the FE. In 1.4.0 (hopefully!) there'll be a location refactor which will surface the restaurant blurb, but for now, it appears in the "Booking" page.

## [1.3.0] - 2026-07-16

Hello again! This release tackles some open feature requests I had, including Home Page customisation, dashboard polish, plus a large internal backend/frontend refactor that shouldn't change anything you see. For the next release, I'm looking into a better restaurant view for the customers as well as Admin Dashboard improvements, cheers!

### Added

- **Home-page customization** (#183, #184, #185, #187) — a configurable subtitle under the app name, a freeform location description (with `[label](url)` inline links), clickable highlight cards with a configurable section heading/subheading, and a hero image fit toggle (Cover/Contain). All fields default to today's behavior when unset.
- **Sortable bookings list** (#208) — the admin bookings table can now be sorted by column.
- **Occupancy chart improvements** (#180) — toggle between a rolling T-x view and calendar-date view, with real booking counts, a summary line, and peak highlighting.
- **Custom time picker** — replaced the native web time input with a dropdown matching the existing date picker's style.

### Fixed

- **Backend hold rejection reasons** (#213) — the UI now surfaces the actual reason a table hold was rejected instead of a generic error.
- **Timezone hint** (#181) — hidden when the viewer's device timezone already matches the restaurant's.
- **Occupancy chart layout** (#223, #224, #225) — closed dead space and layout gaps in both wide and stacked layouts.
- **Sticky footer gap on web** (#226) — `#root` now sizes against the viewport instead of `body`, eliminating a gap below the footer.
- **Dependency security patches** — bumped ASP.NET Core / EF Core to 10.0.10 (July 2026 servicing release) and a handful of other verified non-breaking patch bumps.

### Changed

- Large internal backend and frontend refactor for maintainability — no user-facing behavior changes.

## [1.2.1] - 2026-07-06

Fixed an issue with the Dates appearing incorrectly in the home page

Added a React Native calendar view with closed days blocked out

Fixed the new Lucide icons not working correctly

## [1.2.0] - 2026-07-03

This one's mostly driven by your feedback — thanks for all the issues and comments since 1.1.0! The headline items are per-day opening hours, walk-in-only locations, admin-changeable email, and a customizable footer with social links. There's also a decent pile of smaller bug fixes around past bookings, calendar/email consistency, and mobile UX. As always, please open an issue if anything looks off after upgrading.

### Added

- **Per-day opening hours** (#175) — restaurants can set different open/close times for each day of the week (e.g. Mon–Fri 12–22, Sat 11–23) instead of one set of hours applied globally. `OpenDays` remains the canonical open/closed toggle; hours are stored per-day in `Restaurant.OpenHoursJson` and collapse back to the simple `OpenTime`/`CloseTime` fields when all seven days match. Existing restaurants with uniform hours are unaffected.
- **Walk-in-only locations** (#176) — a location (or specific days of a location) can be marked walk-in only. It stays listed and visible on the public search/home page, but the online booking flow is disabled and replaced with a walk-in notice; the restaurant card shows which days are walk-in-only, including a friendly hint for fully walk-in locations. Admin-recorded bookings are exempt so staff can still log walk-ins during those hours.
- **Customizable booking duration** (#135, #177) — admins can configure how long a booking slot lasts per restaurant instead of the previous hardcoded 1 hour. Availability, conflict checks, and now calendar/ICS event lengths and confirmation emails all respect the configured duration.
- **Admin can change their own email** (#172) — a new field in the admin settings panel lets an admin update the login email for their account directly from the UI, instead of needing manual DB/env changes.
- **Customizable footer with social links** (#186, #182) — the "Admin" link has been moved out of the header (where it was over-prominent on desktop and hidden entirely below 768px on mobile) into a new, always-visible page footer alongside configurable copyright text and social links (Instagram, Facebook, X, TikTok, YouTube, or any custom link) editable from the Admin settings.
- **Keyboard shortcuts** (#140) — logical keyboard shortcuts added across both the admin dashboard and the customer-facing booking UI for faster navigation and common actions.
- **Haptic feedback on mobile** (#147) — key interactions (selecting a time slot, confirming a booking, admin actions) now trigger `expo-haptics` feedback on native mobile; no-ops safely on web.
- **More brand favicon icons** (#188) — hamburger, sandwich, soup, cake, and ice-cream-cone added to the selectable Lucide icon set (15 total, up from 10).
- **Nginx caching headers** — Expo's content-hashed static bundles are now served with a permanent `Cache-Control: public, max-age=31536000, immutable`, the app-shell HTML is marked `no-cache` so it's always revalidated, and gzip settings were tightened across all three nginx configs (dev, prod, release).

### Fixed

- **Past bookings** (#159, #160) — customers can no longer cancel a booking that's already in the past, and can no longer create a new booking in a past time slot; admins remain able to record past walk-in bookings.
- **Admin dashboard not refreshing after actions** (#93) — cancelling or deleting a booking (and other admin actions) now correctly refreshes the dashboard view instead of leaving stale data on screen.
- **Calendar/ICS event duration** (#192 follow-up to #135/#177) — Google Calendar links, Outlook links, and the downloaded `.ics` file now use the restaurant's actual configured booking duration instead of a hardcoded 60 minutes; the calendar/ICS description also now includes the assigned table and section.
- **Booking confirmation email formatting** — fixed spacing issues and a missing table/section line in the confirmation email; simplified the confirmation time-range formatting logic.
- **Purge-bookings script** — now also wipes and restores uploaded media (moved the media snapshot into `data/` for VPS persistence across the demo reset cron), so a purge leaves the media volume in a consistent state with the database.
- **Nginx ports bound to localhost** — the nginx container's exposed ports are now bound to `127.0.0.1` instead of all interfaces, reducing exposure on multi-tenant hosts.
- **Location Manager polish** — removed leftover step-number labels and a stray monospace font from the Location Manager UI.

## [1.1.1] - 2026-06-29

Fixed an issue with the Admin Email not correctly being set by the ENV vars in the Docker Environment

Fixed the release job not correctly accounting for the v prefix

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

[1.0.0]: https://github.com/karanshukla/openresto/releases/tag/v1.0.0
[1.1.0]: https://github.com/karanshukla/openresto/releases/tag/v1.1.0
[1.1.1]: https://github.com/karanshukla/openresto/releases/tag/v1.1.1
[1.2.0]: https://github.com/karanshukla/openresto/releases/tag/v1.2.0
[1.2.1]: https://github.com/karanshukla/openresto/releases/tag/v1.2.1
[1.3.0]: https://github.com/karanshukla/openresto/releases/tag/v1.3.0
[1.3.1]: https://github.com/karanshukla/openrest/releases/tag/v1.3.1
