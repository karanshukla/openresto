# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Untangled the circular dependency between `useBookingSeating` and `useTableHold`** (#316) — the split in #315 left one seam: the hold hook needs the seating pick, and the seating hook was calling back into the hold hook to drop a hold its own change had invalidated. `BookingForm` bridged that with a ref assigned during render, which only worked because of the order the two hooks happened to be called in. The explicit release turned out to be redundant: every param that identifies the held unit is already a dependency of the hold effect, so a seating change either stops being holdable (released outright) or resolves to a different unit (replaced atomically, forwarding the old hold id so the server frees it in the same call). The ref, the `releaseCurrentHold` argument and the party-size release effect are all gone, and `releaseCurrentHold` is no longer exported so the cycle can't come back. Data now flows one way, which means swapping the two hook calls fails to compile rather than silently changing behaviour. Four `useTableHold` tests cover the contract the ref was standing in for: pick cleared, pick moved to another table, table swapped for a combinable group, and a param outside the held unit (the email) changing without churning a valid hold.

## [1.7.0] - 2026-08-12

This is a frontend focused release. I wanted to move away from responsive design towards interfaces that felt familiar on mobile and web. I also wanted to give the code some love, so a ton of refactoring and accessibility passes have been included.

Next up, I wanted to tackle the biggest piece of tech debt, which is accounts. Right now, the app is scoped to one admin. While I originally designed the app for one person, I realise now the app is in a good enough state to think about scale. While I don't believe the app should be used for large scale franchising, with the UI changes, and future Admin changes, it'll be more than suitable for owners with 5+ locations. One other use case, is separating out your existing Restaurant into separate "locations." such as an upstairs, downstairs, patio etc.

Cheers!

### Added

- **Locations page redesigned around comparing locations, not reading one at a time** (#302) — party size, date and meal window move out of each card and into a page-level filter bar that drives every card's availability at once and summarises the result ("2 of 3 locations have tables"). Cards shrink from a 21:9 banner (~700px tall, one fit on screen) to a 108px tile (64px on phones) so several fit above the fold. Booking moves out of the per-card accordion into a floating panel beside the list on wide screens or a bottom sheet on phones, opened by tapping a time; guests, date and time are inherited so the panel only asks for name, email and confirm. Nothing is removed — sections, tables, the seating map, weekly hours, directions, the blurb and the menu still live behind "Details," just demoted below the decision. Follow-ups iterated on the panel itself: it floats as a rounded, inset card on desktop instead of a full-height square welded to the page edge (#308); the mobile sheet's grab handle actually drags, springing back or dismissing past a threshold (#308); guests and date got their own row in the panel again after the redesign hoisted them into the bar and left no way to change them once the panel was open (#307); and the seating disclosure, exact-time picker and privacy note settled into three labeled sections (Time / Your details / seating) instead of one flat stack (#307, #308).
- **Accessibility primitives and a full labeling sweep** (#303, #305, #306, #314) — the frontend had one shared `Button` used in 5 places, 242 hand-rolled `Pressable`s, and 219 loose `Ionicons` at 17 ad-hoc sizes, with no consistent way to give any of them a screen-reader name. New `Icon` (named size scale, decorative by default), `Button` (variant × size, loading/disabled state exposed), `IconButton` (requires a label — an icon-only control with no name fails WCAG 4.1.2 outright), and `ModalCard` (labelled dialog role, `aria-modal`, focus save/restore) primitives replace three near-duplicate modal implementations and back every subsequent fix. Every interactive element in `app/` and `components/` now has a name and a role: the shared pickers (DatePicker, TimePicker, Select) expose dialog/menu semantics and announce their current value instead of a bare chevron; choice groups that only differed by border color (SMTP providers, brand colors, favicon/highlight icons, filter pills) became radios with real checked state; booking and availability-grid rows collapse from four loose text nodes into one announced summary; and six horizontally-scrolling rows (admin pills, the danger-zone picker, the home page's highlights rail) gained a named group, a "scrolls sideways" hint, and a visible scroll button on whichever end still has content, via a new shared `HorizontalScroller`.
- **Route Manifest CI check** — the Expo Router breakage that briefly re-parented every admin route under a phantom `/admin/_layout.styles/...` subtree (see Changed) passed `tsc`, all Jest tests and lint; only an E2E run against real routing caught it. `npm run routes:check` now exports the web build, derives the route list from the emitted HTML, and diffs it against a committed `routes.snapshot.txt` in its own CI job, so a route regression is named immediately rather than buried in a Frontend CI failure. Intentional route changes go through `npm run routes:update` and a committed snapshot, since routes are public URLs.

### Changed

- **One source of truth for the release version** — v1.6.0 shipped with all four `version` fields still reading `1.5.0`, and the Expo app version had been stuck at `1.0.0` since the first commit, because nothing checked. `app.config.ts` now takes its version from `openresto-frontend/package.json` (and the dead duplicate in `app.json`, which `app.config.ts` overrides anyway, is gone), so the frontend can't drift. A new `scripts/check-release-version.sh` asserts both `package.json`s, both lockfiles, and a matching CHANGELOG section all agree with the tag; the release workflow runs it as a `verify-version` job gating all three image builds, so a half-finished bump fails before anything is published to GHCR. Run it yourself before tagging.

- **Scroll-to-top button now appears on every device**, not just portrait phones under 700px. The app has grown vertically (the booking form alone is a full screen taller since the stacking fix), and the wide layouts that scroll furthest were the only ones without the shortcut. Only the scroll distance gates it now, so the same 300px threshold applies everywhere it is mounted: home, locations, lookup and booking confirmation.
- **One breakpoint instead of two.** `768` and `700` were both in use as "this is a phone", so a 720px window got mobile container padding with a desktop hero. Both now come from `constants/breakpoints.ts`, which `BookingForm`, `PageContainer`, `Navbar`, the home page, lookup and the confirmation screen (plus its skeleton) all read. The home hero's compact styling starts at 768 as a result, matching the navbar it sits under. The grid-column thresholds on the home page and the admin-only widths are left alone: they answer a different question and are not duplicates of each other.
- **Home page redesigned to behave like an app, not a page that resizes.** Cards now confirm a press with a haptic and a surface change (a hover border was the only feedback before, and does nothing on a phone); a new `RestaurantCardSkeleton` fills the real card's shape while loading so the grid settles instead of jumping from a spinner to a full grid; and the four highlight cards, which stacked four-high on a phone and pushed every location off screen, are now a snapping rail with the next card peeking. The hero title collapses into the navbar as you scroll, driven by a CSS scroll timeline rather than a scroll handler so it doesn't re-render the page every frame on the same thread the list is busy on. The page also moved off its own six warm color literals onto the same theme tokens every other screen uses, closing a long-standing split where the home page read warm against a cool app.
- **Route and panel transitions moved onto the compositor.** Both used `Animated` without the native driver, which ticks from JS on the same thread mounting the incoming screen — measured 49ms between frames during a route change, stuttering a 140ms fade through three visible steps. They now run through the Web Animations API, which puts opacity and transform on the compositor and keeps the animation clock stepping smoothly regardless of main-thread load. The route fade also moved from `useEffect` to `useLayoutEffect` so the incoming view no longer paints at rest for a frame before dropping to 0.88 opacity, and the side panel's entrance dropped from 200ms to 150ms so it no longer arrives after the list column has already snapped open around an empty gap. Tapping a time on the home page now expands the matching card on the Locations page rather than opening the booking panel over a list of collapsed cards with no indication which location was picked.
- **A large frontend styling-architecture cleanup.** All 207 remaining bare `Ionicons` call sites and 470 inline style-object literals across the admin settings cards were routed through the shared `Icon` component and sibling `.styles.ts` files respectively, closing out drift where the same surface (a tile, an empty state, a two-step delete confirmation) had three independently-maintained copies. Every component under `components/` now follows the sibling-`.styles.ts` convention uniformly, and `LocationListItem` (585 → 286 lines) and `BookingForm` (816 → 456 lines) were split into named subcomponents and hooks (`useLocationSlots`, `useBookingSeating`, `useBookingAvailability`, `LocationDetailsPanel`, `BookingFormFields`, and so on) so the parts doing the actual work aren't buried in a thousand-line function body. One extraction briefly broke production: putting `<Screen>.styles.ts` next to its screen inside `app/` made Expo Router load `app/admin/_layout.styles.ts` as a _layout_ (matching the `_layout` convention) and silently re-parent the entire admin route subtree — caught by the E2E smoke run, fixed by moving screen-level styles to a mirrored `styles/` tree outside `app/`, and now guarded permanently by the Route Manifest check above.
- Backend coverage tooling and CI reliability: Coveralls upload steps are now `continue-on-error` so a transient GitHub Releases download failure in the coverage-reporter installer no longer fails the backend/frontend jobs (and blocks every downstream job) when tests and builds passed fine.

### Fixed

- **Booking form rendered its desktop two-column grid on phones**: the side-by-side field pairs were gated on `Platform.OS === "web"`, and a phone browser is `web`, so a 390px screen got the same two columns as a 1280px desktop. Each column came out around 180px wide: the email address truncated mid-string, the special-requests placeholder wrapped to three lines, and the "we'll seat you at the best available table" hint ran two lines deep next to Full Name. The pairs now collapse below 768px (the width `PageContainer` already switches its padding at, so the form and its container agree), giving Email and Special Requests a full-width row each, and the table-hold countdown moves out of the email column to sit directly above Confirm Booking where it is actually read. Native already stacked, and desktop web is unchanged.
- **Dark-mode route transitions flashed white** — React Navigation paints its own default background, `rgb(242,242,242)`, inline on the screen container beneath everything the app renders. Nothing in `global.css` can reach an inline style, so it was invisible until the route fade dropped the incoming view to 0.88 opacity for 140ms and let 12% of that near-white layer through the whole viewport on every navigation. The root `Stack` now sets `contentStyle` to the app's own page color.
- **Compact filter bar squeezed the guest count into a single pixel dot** — on a 390px phone the bar's fixed 1:2:2 split gave the guests control 64px against the ~79px its icon, two digits and chevron need, so the count ellipsised away and the control read as a bare icon. Controls whose labels already say what they are ("Today", "All") dropped their icon so the guest count could keep both its icon and its digits, and the bar now wraps onto a second line on very narrow phones instead of squeezing a third control.
- **Availability summary text spilled out of the filter bar and over the page** — the three filter controls hold a fixed minimum width totaling 452px, and once the booking panel took 460px off the list column, viewports around 1100px left the summary nowhere to sit. The bar now wraps, dropping the summary onto its own right-aligned line.
- **Dragging the booking sheet down to dismiss it could trigger the browser's own pull-to-refresh reload** instead, on mobile browsers, losing the sheet, the table hold and anything typed into the form. `overscroll-behavior-y: contain` on `html`/`body` drops pull-to-refresh app-wide without touching ordinary scrolling, and the grab handle, header and backdrop set `touch-action: none` so the browser hands those touches straight to the pan responder.
- **Non-composable SQL error in the startup `journal_mode` diagnostic query** — `FirstOrDefault()` on a raw `PRAGMA` query made EF Core wrap it in a `LIMIT 1` subquery, which SQLite rejects for `PRAGMA` statements. Matches the `integrity_check` call beside it: materialize with `ToList()` first, then take `FirstOrDefault()` client-side.
- **Two Playwright specs asserted page-wide instead of scoping to the location under test** — the Locations redesign turned `/book?restaurantId=` into a redirect that renders the whole list scrolled to one location rather than a single-restaurant page, so the pause/walk-in specs' unscoped slot-chip counts and `.first()` text assertions could match a different, unpaused location. Both now scope to the location card under test. A related environment issue was masking the real failures behind unrelated 502s: nginx's `resolver` directive was appending `127.0.0.1` even when `resolv.conf` already named one, and `resolver` round-robins rather than failing over, so on Podman (where DNS lives on the gateway, not `127.0.0.1`) roughly half of all proxied requests 502'd despite every container reporting healthy.
- **VPS deploys risked a no-space build failure and a public 502 window on every recreate** — `docker image prune -f` never touches BuildKit's own cache, which had grown to 5.29GB with the disk at 86%; it's now capped by size rather than age, since the VPS deploys several times a day and an age filter would free nothing. Separately, the reverse proxy's `service_healthy` condition gated the only container publishing the port it fronts, turning every container recreate into a public 502 window; nginx only needs container start order; it resolves upstreams via Docker's own DNS at startup, not at health-check time.

### Security

- Backend bumped to ASP.NET Core/EF Core 10.0.11, pulling in patched transitive dependencies for two high-severity NuGet advisories flagged by `dotnet list package --vulnerable`: `Microsoft.OpenApi` 2.0.0 (GHSA-v5pm-xwqc-g5wc) via `Microsoft.AspNetCore.OpenApi`, and `SQLitePCLRaw.lib.e_sqlite3` 2.1.11 (GHSA-2m69-gcr7-jv3q) via `Microsoft.EntityFrameworkCore.Sqlite`.
- `nanoid` overridden to `^3.3.17` to clear GHSA-2v37-7h3g-55p8 (indefinite loop when a custom generator is called with size zero), reached transitively at 3.3.16 via `expo-router` and `postcss`. Pinned with a caret rather than the unbounded `>=` used elsewhere in the overrides block: an unbounded range resolves to nanoid 6, which drops the `require` export condition that `postcss`'s CommonJS `require("nanoid/non-secure")` depends on.

## [1.6.1] - 2026-08-09

A small release on top of 1.6.0: one new option (digits-only booking references) and the fixes that shook out of it.

### Added

- **Numeric booking reference format** (#179) — a location can now hand out digits-only booking references (`48273910`) instead of the word-based default (`crispy-basil-saffron`), via a new "Booking reference format" selector on the admin Restaurant info card. Some restaurants would rather read a number down the phone. Backed by a `BookingRefFormat` column on `Restaurant` (defaults to `AlphaNumeric`, so nothing changes unless you switch it) exposed as a string on the restaurant DTO, and a `NumericBookingRefGenerator` sitting alongside the existing word generator; all three places that mint a reference — customer booking, combinable-group booking, and admin-recorded walk-in — route through a single `BookingRefFactory` that reads the location's setting. Numeric references are 8 digits with a non-zero leading digit, a ~90-million-wide space (three orders of magnitude larger than the word format's), so switching cannot make collisions more likely. Existing bookings keep whatever reference they were issued.

### Fixed

- **Numeric references broke the booking confirmation page** — the confirmation route told a database id from a booking reference by shape, so an all-digit segment was looked up through the authenticated by-id endpoint. Every numeric reference took that branch, 401'd for the diner who owns the booking, and rendered as "no booking found": once on the redirect straight after booking, and again on the "view booking" link in the confirmation email. Shape can no longer separate the two, so the public reference lookup runs first and the id lookup stays as a fallback for legacy `/booking-confirmation/<id>` links.
- **Confirmation screen options never applied on native** — `app/(user)/_layout.tsx` registered a `Stack.Screen` named `booking-confirmation/[bookingId]`, but the route file has always been `[bookingRef].tsx`. Expo Router matches on the filename, so the entry matched nothing and the screen silently lost its "Booking Confirmed" title and suppressed back button. Web looked fine because that title comes from the root layout, which is why it went unnoticed. A new test walks the registered screen names and asserts each resolves to a file on disk, so a route rename fails loudly next time.
- **Demo artwork was wiped by the 2-hourly reset** — seed data hardcoded image URLs, so a reseed could point at files that no longer existed and uploaded images did not survive. `demo_data.py` now derives media URLs from what is actually on disk (`MediaService` writes into deterministic slots), leaving them NULL when the file is absent.
- **Flaky `LocationListItem` slot-chip test** — the assertion depended on the wall clock and failed inside certain windows.

### Changed

- **Seed and demo data consolidated into `scripts/demo_data.py`** (#297) — three hand-maintained copies of the same dataset had drifted apart. There is now one generator that emits SQL, with `seed-local.sh` and the demo VPS's `purge-bookings.sh` as thin wrappers over it. The dataset deliberately exercises every feature flag the product has (per-day hours including a past-midnight wrap, both booking-ref formats, all contact-fallback states, walk-in-only global and per-day, an archived location, the oversize cap, named and unnamed combinable groups), and generates bookings against the same rules the server enforces so seeded rows never conflict. Dev tooling only, not part of the production image.

## [1.6.0] - 2026-08-07

Hello! The headline of this release is **combinable table groups** — you can now flag physical tables as pushable-together (tables 8 & 9 become one 6-top for a party of 6) and the whole booking engine understands them: availability, auto-assign, holds, the diner dropdown, the seating minimap, and the large-party guard. Combinable tables stay individually bookable - grouping only makes them fill last, so they stay free for the larger parties that actually need them merged.

Also in here: per-location contact info for multi-location deployments, two-step delete confirmations, and a refreshed table/section settings screen.

### Added

- **Per-location and global contact info** (#262) — a location can now carry its own optional contact phone and email (admin → Restaurant info), with brand-wide defaults on the Brand Identity card for deployments that share one number across every location. Both are exposed on `GET /api/restaurants/{id}` and `GET /api/brand`, and both follow the existing PATCH convention (empty string clears, omitted leaves untouched). The large-party notice resolves them per-field — location value first, then the brand default, then the existing global social links — so a multi-location deployment finally shows the right number. `SocialLink` stays global and unchanged.
- **Two-step delete friction for tables & sections** (#270) — deleting a table or section now requires a deliberate two-step inline confirmation (Delete… → Yes, delete / Cancel), matching the locations `DangerZone` pattern, instead of a single center-screen modal. The confirmation surfaces the concrete consequence — how many non-cancelled future bookings will lose their table/section reference — via a new best-effort `GET /api/restaurants/{id}/sections/{sectionId}/tables/{tableId}/impact` and `…/sections/{sectionId}/impact` read; if the count is unavailable the UI falls back to generic copy. No change to what the backend deletes or FK-nulls.
- **Combinable table groups — schema + CRUD API** (#271) — introduces a `TableGroup` entity so an admin can flag physical tables (e.g. 8 & 9) as combinable and book them as one unit for larger parties. Backend-only foundation (schema, service, API); availability/auto-assign/holds wiring and UIs land in follow-ups. Adds `POST`/`PUT`/`DELETE /api/restaurants/{id}/groups` with server-enforced data-integrity rules (members belong to the same restaurant, aren't already grouped, ≥ 2 members, `largest member seats < CombinedSeats ≤ sum of member seats`), a `Booking.TableGroupId` nullable column, a unique index so a table joins at most one group, and `Groups` on the restaurant DTO. Deleting a group clears the reference on affected bookings in a single save.
- **Combinable table groups — availability, auto-assign & holds wiring** (#272) — a `TableGroup` is now a first-class bookable unit in the booking engine. Availability advertises bookable groups per slot (a new `availableGroupIds` list on `TimeSlotDto`, parallel to `availableTableIds`); auto-assign prefers an ungrouped table, then a combinable one, then a group (deprioritization — combinable tables fill last, giving larger groups more time to book); placing a group hold reserves all member tables atomically (one multi-table `HoldEntry` whose members are all treated as busy); booking a group checks that every member is free of a conflicting booking or hold (mutual exclusion), and a member's own booking/hold blocks the group. The optional `MaxTableOversizeSeats` cap applies to groups too.
- **Combinable table groups — admin UI** (#273) — owners can define, edit, and break combinable table groups inline from the section view: a `Link` affordance on each standalone table enters a selection mode to combine 2+ tables into a group (combined seats default to the member sum); member rows render inside a tinted sub-block with a `⛓ Tables X + Y (N combined)` chip carrying an inline remove affordance; removing down to one member dissolves the group; combined seats are editable. Tables already in a group are disabled in another table's selection mode. The section header reflects table/seat/group counts.
- **Combinable table groups — diner dropdown & large-party threshold** (#274) — combinable groups appear in the diner table dropdown with a clear label (named groups use their name; unnamed use "Tables X + Y"), and the large-party guard now accounts for combined capacity so the "contact the restaurant" notice only fires when even merged tables can't seat the party. Group options respect per-slot availability (`availableGroupIds`); selecting a group reserves the combined tables server-side (#272). The "Any section" auto-assign path is unchanged.
- **Combinable groups in the diner seating minimap** — the seating block under the booking form listed every table individually with no hint that some of them push together, so the only place a diner could discover a group was the table dropdown, after they had already picked a party size large enough to need one. Member tables are now marked with a link icon and each group gets its own row ("Window booths — Seats up to 5 pushed together"). Members are still listed individually, since grouping only deprioritizes them (#242). Group naming moved into a shared helper so the minimap and the dropdown can't drift on what a group is called.
- **Seat counts are now constrained dropdowns, validated end to end** — the admin table seats field, the add-table row, and the combinable-group combined-seats editor are pickers bounded to 1–50 instead of free-text inputs, so `parseInt`/`NaN` states are gone. Backed by a matching server-side `[Range(1, 50)]` on every DTO that carries a seat count (booking create/update, table create/update, group create/update) plus service-level guards for callers that bypass model binding — a single `BookingLimits` constant is the source of truth for both ends.

### Fixed

- **Merged tables could be double-booked** — `IsTableBookedOnDateAsync` matched only on `Booking.TableId`, but a group booking persists `TableId = null` with a `TableGroupId`, so every _persisted_ group booking was invisible to every conflict check. Holds were group-aware, but the moment a hold converted to a booking the reservation dropped out of detection — allowing group-vs-group, member-vs-its-group, and re-booking an already-booked group. Conflict resolution now resolves the full set of reserved tables and groups through the membership table and matches on both columns, threaded through all four call sites (single-table, group, and auto-assign hold-adoption paths in `BookingService`, candidate building in `TableAutoAssigner`, and `AvailabilityService`, which also indexes group bookings so members reserved via a group are no longer advertised as free).
- **Group bookings showed no table in the diner UI** — a group booking has a null `Table`/`Section`, so the mapper produced a null table name and the booking detail view simply dropped the row, leaving guests with no idea where they were seated. Group bookings now render a "Tables" row with a readable group label and the combined seat count, applied consistently across the diner view, the admin grid, the confirmation email, and the calendar export.
- **Combinable groups ignored the selected section** — the table dropdown filtered single tables by the picked section but built its group options from the restaurant-wide list, so choosing "Patio" still offered a group made entirely of indoor tables; picking one submitted a null section and the backend derived the section from the group's members, seating the party somewhere they hadn't chosen. A group now qualifies for a section only when every member sits in it — booking a group books all of its tables, so one member elsewhere would split the party across rooms. "Any section" is unchanged and still considers every group, as does the location-wide large-party capacity check.
- **Dropdown options were unclickable on web** — the seats picker opened its modal but tapping an option did nothing and the modal just dismissed: `react-native-web`'s `FlatList` scroll container swallows the touch-start of a tap, treating it as a potential drag, so the option row's press handler never fired. This surfaced now because the admin seats fields were the first web-facing `Select` usages. The option list is a plain scroll view with direct pressable rows — option counts are small enough that virtualization bought nothing.
- **Clearing a location's description did nothing** — the admin settings form sent `description: null` for a blank field, but the backend's PATCH convention reads `null` as "leave untouched", so emptying the blurb and saving silently kept the old text. Blank now goes over the wire as `""`, which clears the field as intended.
- **Clearing a pasted menu link did nothing** — same root cause as the description fix above: a blank menu field was sent as `null`, which the backend reads as "leave untouched". Blank now clears, except while an uploaded PDF is the stored menu — there the field is deliberately left untouched so a save can't wipe the file the upload flow just stored.
- **Combinable tables were removed from normal service** (#242) — flagging tables 8 & 9 as combinable made them bookable _only_ as the merged 8-seat unit, so two 4-tops silently dropped out of the availability feed and out of auto-assign for every party of 4. They are now offered individually again, and the deprioritization asked for in the issue does the real work: within a given size, an ungrouped table is assigned before a combinable one, which is assigned before a group — so combinable tables stay free as long as possible for the larger parties that need them pushed together. Mutual exclusion between a member's own booking and its group's booking was already enforced by the conflict checks, so nothing can be double-booked.
- **Deleting or shrinking a combinable table corrupted its group** (#242) — the memberships → tables foreign key is `ON DELETE CASCADE`, so deleting a member table (or its section) silently dropped the membership row while leaving `CombinedSeats` untouched: a group of 8 backed by a single 4-top, still advertised and still bookable. Table and section deletes now dissolve a group that would drop below two members (FK-nulling its bookings, as group deletion already did) and clamp the survivors' combined seats; resizing a member table reconciles the same way. Booking a group with fewer than two members is refused outright.
- **Delete-impact counts missed merged-table bookings** (#242) — a group booking stores no `TableId`, so the "N future bookings will lose their reference" preview shown in the two-step delete confirmation reported zero for a table whose group had upcoming bookings. Both the table and section impact reads now include bookings held through a combinable group.
- **Combined seats could exceed what the tables can seat** (#242) — `CombinedSeats` was validated as _at least_ the sum of member seats, the opposite of the documented intent: pushing two 4-tops together commonly seats 6, not 8+, because the covers where the corners meet are lost. The accepted window is now "more than the largest member, up to the sum of the members", and the admin combined-seats picker offers exactly that range. Existing groups above the sum are clamped down the next time their tables change.
- **Group booking trusted client-supplied member ids** (#242) — `memberTableIds` is part of the public `POST /api/bookings` body and was used for the "held by another user" check, so a request omitting a member skipped that member's hold check. Members are now always re-resolved from the persisted group.
- **Flaky concurrency test stabilized** — `CreateBooking_AutoAssign_NeverDoubleBooksSameTable_WhenContended` asserted an exact winner count (2) that was timing-sensitive under CI load; it now asserts the hard invariant (1–2 winners, all on distinct tables), removing the spurious CI failure without weakening the no-double-booking guarantee.
- **Group membership creation relied on EF navigation fixup** (#289) — `AddTableGroupAsync`/`UpdateTableGroupAsync` built membership rows with only the table id set and depended on EF populating the navigation during save before the mapper dereferenced it. Any non-EF caller would hit a null reference inside a mapper. The navigation is now set explicitly at construction, and the mapper raises a clear error instead of trusting a null-forgiving operator.

### Changed

- **Table & section settings redesigned** — the admin table and section editors now match the app's established design language (as used by social links and highlights): tables are rounded surface tiles with a leading icon, a name plus seats subtitle, and a tidy trailing action cluster; delete is a trash icon like every other destructive affordance in the app; section headers move their counts to a muted subtitle and consolidate move/rename/delete into one icon cluster; empty sections render as a dashed-border tile. Editing is a labeled "Edit" pill rather than a bare pencil glyph, and the trailing action clusters share one consistent gap throughout.
- **Backend coverage reporting corrected** (#290) — CI's `--collect:"XPlat Code Coverage"` doesn't read the csproj's coverlet `<Exclude>`, so it counted EF migrations that the MSBuild integration (used for local runs) strips — a ~6-point gap between the two numbers with no indication which was authoritative. A shared `coverlet.runsettings` aligns them.
- **Unit test coverage raised** — backend to 99.01% line / 94.07% branch (1,472 tests), covering the combinable-group hold path, the table-group CRUD and delete-impact endpoints, and the auto-assign hold-adoption paths; frontend gaps in the locations list, admin notifications, walk-in utils, and footer settings brought to full coverage.
- **E2E suite split into smoke and extensive runs** — the 78 Playwright tests are partitioned by a `@smoke` tag into 18 golden-path tests (home browse, the full booking journey, confirmation, customer lookup, admin login/logout, dashboard) that run on every PR and push, and 60 that run once per merge to `main`. PRs get fast feedback on the paths a broken deploy can't ship without; `npm run test:e2e` still runs everything locally.
- Dependency security patch — `brace-expansion` override raised to 5.0.9 to close GHSA-rgw5-rvv9-x895 (high, CVSS 7.5), an unbounded intermediate array DoS. The previous override pinned the floor to exactly the vulnerable version.

## [1.5.0] - 2026-07-30

Hello! This release includes an Expo upgrade, routine upgrades, as well as a couple new features below.

### Added

- **Large-party guard & single-location auto-expand** (#261) — booking submission is now blocked when the party size exceeds the largest table at the location, with an inline hint and a modal directing guests to contact the restaurant directly (table merging isn't supported yet). Single-location instances now auto-expand the location card instead of requiring an extra tap.
- **Social links, highlights, and menu URL validation** (#264) — server-side validation for Social Links, Highlights, and the restaurant `MenuUrl` field, following the existing `ValidationException` pattern; blocks unsafe schemes like `javascript:`.

### Fixed

- **Booking time defaulted to midnight** (#257) — `AvailabilityService` and the time picker both leaked a `00:00` default; restaurants now default to a sensible 09:00 open time.
- **Pre-commit linter scope** (#260) — `oxlint --fix` ran against the whole frontend project instead of just staged files, occasionally rewriting unrelated source files during unrelated commits.

### Changed

- **Upgraded Expo SDK 56 → 57** (#267) — `expo`, `react-native`, `typescript`, and related packages bumped to their SDK 57-compatible versions.
- Dependency security patches (#259) — `brace-expansion` and `js-yaml` overrides to close two high-severity Dependabot alerts.
- Routine low-risk dependency bumps across backend (NuGet) and frontend/root (npm) (#266).

## [1.4.1] - 2026-07-26

Hello! OpenResto is in a really good state right now, so no major changes today, but I'm upgrading from Node 20 to Node 24 (which is in LTS).

As always please let me know if there's any other cool features you'd like to see!

- Upgraded the build/runtime toolchain from Node 20 to Node 24 (#252).
- Dependency security patches (#253, #254) — bumped `shell-quote`, React/`react-native-gesture-handler`, and GitHub Actions to their latest stable versions.
- Backend unit test coverage improved from 97.6% to 98.8% line coverage (#255, #256).

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
