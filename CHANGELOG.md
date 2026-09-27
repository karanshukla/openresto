# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

How each feature behaves, its API fields and its error codes are in
[`docs/features.md`](docs/features.md).

## [Unreleased]

### Fixed

- **Waitlist board.** A party that can be seated now no longer shows a quoted wait beside an enabled Seat button. It shows "Free now, skips #N", naming the party ahead that the free table was estimated for.

## [2.3.0] - 2026-09-24

### Added

- **Turn times by party size.** Larger parties can get longer sittings. Availability, holds, auto-assign and the waitlist all use the party's own length. Existing bookings keep the length they were booked with.
- **Booking status.** Mark bookings Arrived, Seated, Finished or No-show from the admin, with five minutes to undo. Finishing early or a no-show frees the table straight away. The bookings list gets a No-shows tab, and lookups show a guest's past no-shows.
- **Walk-in-only tables.** Keep a single table for the door without closing online booking for the whole location.
- **Cover pacing.** Cap how many guests can start in one booking slot. The dashboard shows today's arrivals per slot.
- **Walk-in waitlist.** Guests at a walk-in-only location can join a queue online and see their estimated wait. Staff run it from the new Waitlist page, and calling a party can send a push notification and an email.

### Changed

- Backend packages updated: ASP.NET Core and EF Core 10.0.12, MailKit 4.18.0, Magick.NET 14.17.1 (#449).

### Security

- Browser push addresses that resolve to a private or local network are now refused when the server connects, not just when they're saved.

## [2.2.0] - 2026-09-13

### Added

- On wide screens, the booking result on `/lookup` and `/booking-confirmation` stays in view while the page scrolls.

## [2.1.0] - 2026-09-11

### Added

- Sharing a booking now includes a link to it, on web and in the native app. Browsers without a share sheet copy the link instead.

## [2.0.1] - 2026-09-05

### Added

- The email settings page previews the booking confirmation guests will get. Also available as `GET /api/admin/email-settings/preview`.

### Fixed

- Admin push notifications only arrived for one location. A subscription now covers every location, and existing subscriptions are migrated.
- One browser with bad push keys stopped every other admin from getting notifications.

## [2.0.0] - 2026-09-03

Hey everyone,

This is a massive update for OpenResto. When I started this project a few months ago, I just wanted something that let restaurants take table bookings online. As I've built it, I've learned a lot about software and what people expect from a product, and this release is the result. The highlights are a native app that self-hosters can publish themselves, and translations into multiple languages.

With the native app, the CLI and the API, OpenResto is truly "open": the booking logic is the product, and any frontend can use it. The web frontend is still the priority for the admin.

I think I've fully realised the vision I had for it, and it will keep being maintained and improved. I hope you enjoy using it as much as I enjoyed building it!

### Breaking Changes

- **The CLI's `users create`, `users role` and `users reset-password` commands are removed**, and the server refuses those actions to any API key. Create accounts in the admin UI.
- **Guest endpoints that take a booking reference (lookup, cancel) are limited to 10 requests per minute per IP.** If many guests share one IP (an office, a hotel), raise the limit in your reverse proxy.
- **New booking references end in four digits** (`crispy-basil-thyme-0482`). Existing references still work.

### Added

- **Native guest app** that self-hosters can build and publish to the App Store and Play Store under their own accounts (#388). See [`docs/native-app.md`](docs/native-app.md).
- **Booking reminders** by push notification, in the native app and in browsers (#419).
- **Apple Wallet and Google Wallet passes** for bookings (#420).
- **Settings → Native app page** that checks whether the server is ready for the app and shows which app versions are in use. You can also set a minimum app version.
- **Privacy policy URL** in brand settings, linked from the guest footer.
- **CLI:** `status`, `bookings extend`, `bookings email`, `locations extend` and `locations conflicts`.
- **CLI on npm:** `npm install -g openresto-cli`. The Docker image still ships.
- **Read-only `email` API key scope** to check whether mail is configured and delivering.
- **API Keys screen** now shows how to use a key, with a curl example and links to the CLI and [`docs/http-api.md`](docs/http-api.md) (#409).

### Changed

- The native app uses the platform's own tab bar (#426).
- Party size in the native app is a stepper instead of a dropdown (#424).
- Booking and lookup forms let the phone autofill name and email (#427).
- The admin sidebar's booking search is removed. Press `/` to jump to the bookings list search.
- API key permissions are one None / Read / Write choice per resource.

### Removed

- Unused files in the repository root: `nginx.conf`, `docker-compose.dev.yml` and `DOCKER_README.md`.

### Security

- An API key can no longer create an admin login or take over an existing one.
- Booking references are now random enough that they can't be guessed.
- A failed cancellation no longer writes the guest's email to the log.
- The CLI no longer follows redirects, so it can't send its API key to another server.
- A made-up `X-API-Key` header no longer raises the caller's rate limit.
- A demo reset now deletes API keys created by visitors.

### Fixed

- The native app looks and behaves like an app rather than a shrunken website: correct dark mode, headers, status bar, shadows and layout on tablets.
- Language and theme can be changed from the native app's home screen.
- The service floor counted combinable tables twice, and some of its labels weren't translated.
- The new API key dialog could say "Copied" when nothing was copied.
- API keys without `guests:read` can email guests again.
- Sending email with no SMTP configured now returns a clear `email.not_configured` error.
- Layout and accessibility fixes for the scroll-to-top button and the API key dialog.

## [1.9.0] - 2026-08-27

Hi all! The headline this time is languages: OpenResto now speaks English, French, Spanish and German across the guest site and the admin. The admin timetable has also been rebuilt, and changing a location's hours now tells you which bookings no longer fit.

### Added

- **French, Spanish and German translations**, with a language switcher (#368, #374). Set the default language with `OPENRESTO_DEFAULT_LOCALE`.
- **Error messages from the server are translated** too (#375).
- **Schedule conflicts:** after narrowing a location's hours, the admin lists the upcoming bookings that no longer fit, and the dashboard shows the total (#359).
- Moving a booking pre-fills an email telling the guest about the change.
- Changing a location's timezone warns you if it has upcoming bookings (#362).

### Changed

- The admin timetable shows bookings at their real start and end times, including combined tables and bookings whose table was deleted (#334).
- Admin booking search matches name, email or reference, including partial matches (#358).
- The guest language picker is in the navbar menu (#387).
- Small layout improvements to the new-booking form and the location page.

### Fixed

- Editing a booking could double-book a table. The conflict check had never run.
- Late-night slots after midnight were offered and then refused (#363).
- Walk-in-only days were wrongly reported as schedule conflicts.
- The scroll-to-top button covered the footer's links (#352, #353).
- Bookings outside current opening hours disappeared from the timetable, and overnight hours broke it.
- Several smaller admin fixes: a stuck cancel button, the notifications filter toggle, opening a conflicting booking in place.

### Security

- Unexpected server errors no longer return internal details outside Development.
- Patched `image-size` denial-of-service advisories (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq).

## [1.8.0] - 2026-08-17

Hey everyone! This is a meaty update: multiple admin accounts with Owner and Manager roles, an audit trail, and another frontend pass. Enjoy!

### Added

- **Multiple admin accounts** with Owner and Manager roles (#265). Owners can invite, promote, deactivate and reset other users. Your existing admin becomes the Owner when you upgrade.
- **Activity log** showing who did what in the admin, visible to Owners (#327). Entries are kept for a year by default and can't be deleted.
- **"Book now" button** on every location card (#328).
- **Location picker** inside the booking panel (#329).
- **Live preview** of the home page next to the brand settings.

### Changed

- Settings is split into Brand, Email, Users and Account pages (#322).
- Brand and location settings save automatically, with ten seconds to undo.
- The brand settings are split into five cards.
- Row actions in the admin are labelled buttons instead of bare icons.
- Archiving and deleting act on the location you have selected, and a location must be archived before it can be deleted (#335). Deleting is Owner-only.
- `/lookup` and `/booking-confirmation` are now the same screen (#337). Server errors no longer show as "No booking found".

### Fixed

- **Upgrading to the multi-user schema failed on existing installs.**
- Pausing bookings blocked every future date, not just the pause window (#326).
- Walk-in-only days could still be filled in and submitted (#320), and the date picker couldn't leave them.
- Dropdowns and the date picker now work fully with a keyboard and screen reader (#348, #350).
- Clearing the favicon never saved.
- Many smaller visual fixes to dropdowns, settings cards, notification rows and the email settings banner.

## [1.7.0] - 2026-08-12

This is a frontend-focused release. I wanted interfaces that feel familiar on both mobile and web, and I gave the code some love with a lot of refactoring and accessibility work.

Next up is accounts. The app is currently scoped to one admin, and it's now in good enough shape to think about restaurants with several locations, or one restaurant split into areas like upstairs, downstairs and patio.

Cheers!

### Added

- **Redesigned Locations page** for comparing locations: one filter bar for party size, date and time, smaller cards, and booking in a side panel or bottom sheet (#302, #307, #308).
- **Accessibility pass:** every button and control now has a name and role for screen readers (#303, #305, #306, #314).

### Changed

- The home page behaves more like an app: loading placeholders, a swipeable highlights row, and press feedback.
- Smoother page and panel transitions.
- The scroll-to-top button appears on every screen size.
- Release tooling now checks that every version number matches the tag.

### Fixed

- The booking form used the desktop two-column layout on phone browsers.
- Dark mode flashed white between pages.
- Layout fixes for the Locations filter bar on narrow screens.
- Dragging the booking sheet down could reload the page.
- A startup database check threw a SQL error.
- VPS deploys could run out of disk space and briefly return 502s.

### Security

- ASP.NET Core and EF Core 10.0.11, patching `Microsoft.OpenApi` (GHSA-v5pm-xwqc-g5wc) and `SQLitePCLRaw.lib.e_sqlite3` (GHSA-2m69-gcr7-jv3q).
- `nanoid` pinned to `^3.3.17` (GHSA-2v37-7h3g-55p8).

## [1.6.1] - 2026-08-09

### Added

- **Numeric booking references** (#179). A location can give out digit-only references (`48273910`) instead of words.

### Fixed

- Numeric references broke the booking confirmation page.
- Confirmation screen options didn't apply on native.
- Uploaded demo images were wiped by the demo reset.

## [1.6.0] - 2026-08-07

Hello! The headline of this release is **combinable table groups**: mark tables that can be pushed together (tables 8 and 9 become one 6-top), and availability, auto-assign, holds and the booking form all understand them. Combinable tables can still be booked on their own; they're just filled last.

Also in here: per-location contact info, safer deletes, and a refreshed table and section settings screen.

### Added

- **Combinable table groups** (#271, #272, #273, #274).
- **Contact phone and email per location**, with brand-wide defaults (#262).
- **Delete confirmations** for tables and sections that show how many upcoming bookings are affected (#270).
- Seat counts are dropdowns limited to 1–50.

### Changed

- Redesigned table and section settings.
- Dependency security patch for `brace-expansion` (GHSA-rgw5-rvv9-x895).

### Fixed

- **Combined tables could be double-booked.**
- Combinable tables were only bookable as a group (#242).
- Deleting or shrinking a table in a group left the group advertising seats it didn't have (#242).
- Group bookings showed no table to the guest, and groups ignored the selected section.
- Dropdown options couldn't be clicked on web.
- Clearing a location's description or menu link didn't save.

## [1.5.0] - 2026-07-30

Hello! This release includes an Expo upgrade, routine updates and a couple of new features.

### Added

- Bookings are blocked when the party is larger than any table, with a prompt to contact the restaurant (#261). Single-location sites open the location automatically.
- Server-side validation for social links, highlights and menu URLs (#264).

### Fixed

- Booking times defaulted to midnight (#257).
- The pre-commit linter touched unrelated files (#260).

### Changed

- Expo SDK 57 (#267).
- Dependency security and routine updates (#259, #266).

## [1.4.1] - 2026-07-26

Hello! No major changes today. I'm upgrading from Node 20 to Node 24, which is now LTS.

As always, let me know if there are any features you'd like to see!

- Node 24 (#252).
- Dependency security patches (#253, #254).

## [1.4.0] - 2026-07-20

Hello! This release reworks the booking pages. As always, let me know if you run into any issues!

### Added

- **Redesigned navigation** (#196, #205, #211, #240). One Locations page for browsing and booking, full weekly hours, and a menu with theme and help.
- **"Any section"** is the default in the booking form, and the server picks the table (#243, #248).
- **Booking start interval** of 15, 30 or 60 minutes, separate from booking length (#245, #247).
- **Maximum table oversize** so small parties don't get large tables (#244, #249).
- **Menu PDF upload** (#246, #250).

### Fixed

- Admin pages clashed with the new `/locations` page. Admin routes now live under `/admin`.
- Locations card and overflow menu polish (#241).

## [1.3.1] - 2026-07-17

- Admin bookings page styling and column widths.
- The location description now shows on the booking page.

## [1.3.0] - 2026-07-16

Hello again! This release adds home page customisation, dashboard polish, and a large internal refactor that shouldn't change anything you see.

### Added

- **Home page customisation** (#183, #184, #185, #187): subtitle, location description with links, clickable highlight cards, and hero image fit.
- Sortable admin bookings list (#208).
- Occupancy chart improvements (#180).
- A dropdown time picker on web.

### Fixed

- The UI shows why a table hold was refused (#213).
- The timezone hint is hidden when it matches your own (#181).
- Occupancy chart and footer layout fixes (#223, #224, #225, #226).
- ASP.NET Core and EF Core 10.0.10.

## [1.2.1] - 2026-07-06

- Fixed dates showing incorrectly on the home page.
- Added a native calendar view with closed days blocked out.
- Fixed the new Lucide icons.

## [1.2.0] - 2026-07-03

This one's mostly driven by your feedback. Thanks for all the issues and comments since 1.1.0! Please open an issue if anything looks off after upgrading.

### Added

- **Opening hours per day of the week** (#175).
- **Walk-in-only locations**, or walk-in-only days (#176).
- **Booking length per location** instead of a fixed hour (#135, #177).
- Admins can change their own email (#172).
- **Footer with social links**, which is also where the Admin link now lives (#186, #182).
- Keyboard shortcuts (#140) and haptic feedback on mobile (#147).
- Five more favicon icons (#188).
- Caching headers in nginx.

### Fixed

- Guests could cancel or book bookings in the past (#159, #160).
- The admin dashboard didn't refresh after actions (#93).
- Calendar links ignored the booking length (#192).
- Confirmation email formatting.
- nginx ports are bound to `127.0.0.1`.

## [1.1.1] - 2026-06-29

- Fixed the admin email not being set from environment variables in Docker.
- Fixed the release job's handling of the `v` prefix.

## [1.1.0] - 2026-06-22

Hello! Thanks for reading, and for the 50 stars on GitHub! This release builds on 1.0.0 with feedback-driven polish and some cleanup. Let me know if you run into any issues.

### Added

- **Booking controls:** pause new bookings or extend active ones by an hour.
- Redesigned Location Manager.
- Restaurant photo and a shared template in emails.
- "Opens in Xh Ym" on closed restaurants.
- Configurable website URL for links in emails.

### Fixed

- Bookings with no end time counted as active forever.
- The email's "Manage your booking" link opens the booking directly.
- Header images in emails used relative URLs.
- HSTS enabled in the production nginx config.
- Faster arm64 Docker builds.

## [1.0.0] - 2026-06-17

### Added

- Multi-restaurant booking with no guest accounts. Guests use a booking reference.
- Admin dashboard for bookings, tables, sections, pausing and branding.
- Five-minute table holds during checkout.
- Timezone-aware availability.
- Lunch, Dinner and Off-Peak slot labels.
- White-label branding with dynamic PWA icons.
- Optional email (SMTP) and push notifications (VAPID).
- Permanent booking deletion for GDPR.
- Multi-arch Docker images on GHCR and a pinned `docker-compose.yml` per release.
- Automatic database migrations on startup. See [`docs/backup-restore.md`](docs/backup-restore.md).

[1.0.0]: https://github.com/karanshukla/openresto/releases/tag/v1.0.0
[1.1.0]: https://github.com/karanshukla/openresto/releases/tag/v1.1.0
[1.1.1]: https://github.com/karanshukla/openresto/releases/tag/v1.1.1
[1.2.0]: https://github.com/karanshukla/openresto/releases/tag/v1.2.0
[1.2.1]: https://github.com/karanshukla/openresto/releases/tag/v1.2.1
[1.3.0]: https://github.com/karanshukla/openresto/releases/tag/v1.3.0
[1.3.1]: https://github.com/karanshukla/openresto/releases/tag/v1.3.1
[1.4.0]: https://github.com/karanshukla/openresto/releases/tag/v1.4.0
[1.4.1]: https://github.com/karanshukla/openresto/releases/tag/v1.4.1
[1.5.0]: https://github.com/karanshukla/openresto/releases/tag/v1.5.0
[1.6.0]: https://github.com/karanshukla/openresto/releases/tag/v1.6.0
[1.6.1]: https://github.com/karanshukla/openresto/releases/tag/v1.6.1
[1.7.0]: https://github.com/karanshukla/openresto/releases/tag/v1.7.0
[1.8.0]: https://github.com/karanshukla/openresto/releases/tag/v1.8.0
[1.9.0]: https://github.com/karanshukla/openresto/releases/tag/v1.9.0
[2.0.0]: https://github.com/karanshukla/openresto/releases/tag/v2.0.0
[2.0.1]: https://github.com/karanshukla/openresto/releases/tag/v2.0.1
[2.1.0]: https://github.com/karanshukla/openresto/releases/tag/v2.1.0
[2.2.0]: https://github.com/karanshukla/openresto/releases/tag/v2.2.0
[2.3.0]: https://github.com/karanshukla/openresto/releases/tag/v2.3.0
[Unreleased]: https://github.com/karanshukla/openresto/compare/v2.3.0...HEAD
