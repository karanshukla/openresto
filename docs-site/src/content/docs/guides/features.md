---
title: Feature reference
description: How each booking feature behaves, and the API fields, error codes and settings behind it.
sidebar:
  order: 1
---

This page documents how OpenResto's booking features work along with the API fields, error codes, CLI commands, and settings behind them. See the [changelog](https://github.com/karanshukla/openresto/blob/main/CHANGELOG.md) for release history, the [API guide](/api/authentication/) for calling the API, and the [native app guide](/guides/native-app/) for mobile builds, reminders, and Wallet passes.

When the API rejects a request, the JSON response includes a machine-readable `code` field and a localized error `message`.

## Opening hours and schedules

### Per-day hours

Each day of the week has its own open and close times. Services that close past midnight belong to the day they opened (for example, Saturday `18:00–02:00` slots belong to Saturday).

### Last booking time

A venue open until `22:00` can stop taking table bookings at `20:15`. Guests still see the full opening hours, while available slots stop at the cutoff (the cutoff time itself is the last start time offered).

- Can be configured globally for the location or overridden per day.
- Must fall within that day's opening hours, including services that run past midnight.
- Staff can still create bookings after the cutoff. Existing bookings past the cutoff are not flagged as schedule conflicts because the venue is still open.
- **API fields:** `lastBookingTime` on the restaurant (empty string clears) and `lastBooking` on each `openHours` entry.
- **Error codes:** `restaurant.past_last_booking` (hold or booking after the cutoff), `restaurant.last_booking_outside_hours` (cutoff outside opening hours).

### Slot interval

Bookings start on a `15`, `30`, or `60` minute grid (default `30`). Slot interval is independent of booking duration.

### Date exceptions

Date exceptions override the weekly schedule for specific calendar dates without changing regular hours. Staff bookings are exempt from all three types.

| Type           | Behavior                                                                                                                                      | Guest error code             | Conflict reason       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------- |
| `closed`       | No service; no slots offered                                                                                                                  | `restaurant.closed_at_time`  | `closedDate`          |
| `specialHours` | Replaces that day's hours with its own `open` and `close` (opens normally closed weekdays); uses only its own `lastBooking`, ignoring weekly  | None                         | `outsideSpecialHours` |
| `walkInOnly`   | Keeps weekly hours but disables online bookings for that date                                                                                 | `booking.walk_in_only_today` | None (never conflicts) |

- **API field:** `dateExceptions` on the restaurant, an array of `{ date, type, open?, close?, lastBooking? }` with `date` as `yyyy-MM-dd` and times as `HH:mm`.
- **`PUT` semantics:** `null` leaves existing exceptions unchanged, `[]` clears all exceptions, and any other array replaces the list. Past dates are dropped on save, and duplicate dates are rejected.
- **Validation error codes:** `restaurant.date_exception_date_invalid`, `restaurant.date_exception_duplicate_date`, `restaurant.date_exception_type_invalid`, `restaurant.date_exception_hours_required` (`specialHours` missing `open` or `close`), and `restaurant.last_booking_outside_hours`.
- **CLI:** `openresto locations dates list|add|remove`.

### Schedule conflicts

Editing opening hours, removing an open day, or changing a location's timezone does not modify existing bookings. If upcoming bookings fall outside the new schedule, the Locations page lists them and the dashboard displays the total count. Walk-in-only days do not create conflicts because the location remains open.

- **CLI:** `openresto locations conflicts`.

### Timezone changes

Bookings are stored in UTC, so changing a location's timezone keeps reservations at the same instant in time. However, local times printed in previously sent confirmation emails will no longer match, and emails are not re-sent. The admin displays a warning when changing the timezone of a location with upcoming bookings.

## Booking length (turn times)

Each location has a default booking duration. Turn-time rules allow larger parties to stay longer: each rule specifies a minimum party size and a duration, and a party matches the rule with the highest `minSeats` at or below its size. Parties smaller than every rule use the location default.

- **API field:** `turnTimes` on the restaurant, e.g. `[{ "minSeats": 3, "minutes": 90 }]`. On update, `null` leaves existing rules unchanged and `[]` clears them.
- Availability, table holds, auto-assign, admin bookings, waitlist seating, and wait estimates all apply the party's computed duration (which is why hold requests include party size).
- Existing bookings retain the duration they were created with.

## Booking status

Booking status tracks service progress on the day of the reservation and is separate from cancellation. A booking advances through **Booked → Arrived → Seated → Finished**, or **Booked → No-show**.

- **No-show** becomes available once the sitting starts.
- The most recent status change can be undone for 5 minutes.
- Marking a booking **Finished** early or **No-show** ends the sitting immediately, freeing the table for availability, holds, and the waitlist. Undoing restores the original end time.
- Waitlist parties start in the **Seated** status once seated.
- In the bookings list, an unmarked booking displays as **Due** after its start time and **Unmarked** after its end time.
- A guest's no-show count is computed across all locations from bookings matching their email. Because it is not stored separately, GDPR-purging bookings also removes their no-show history.
- Guests do not see booking statuses, and no-shows do not trigger charges or blocks.
- **API:** `POST /api/admin/bookings/{id}/status` with `{ "status": "Seated" }` (requires `bookings:write`, audited as `booking.status`). Admin booking reads include `status`, `nextStatuses`, `undoStatus`, and `previousNoShows` (`previousNoShows` is omitted for API keys without `guests:read`). Filter the list with `status=noshow`.

## Walk-ins

Use these controls to reserve capacity for walk-in guests:

- **Walk-in-only location or days:** The location stays visible online, but the booking form is replaced with a walk-in notice. Availability returns empty and online holds/bookings are declined. Staff can still record bookings in the admin.
- **Walk-in-only table:** Keeps a specific table reserved for walk-ins every day. It is excluded from online availability and auto-assign, and any online hold or booking targeting it fails with `table.walk_in_only` (`409`). Any combinable group containing that table is also excluded online. Staff and the waitlist can still seat it. **API field:** `walkInOnly` on tables.

## Walk-in waitlist

The waitlist allows guests to queue for a table online whenever a location is open and set to walk-in-only. Staff can add walk-in parties at the door on any day.

- Guests choose a party size, see an estimated wait time, and provide a name and optional email. Their ticket shows queue position and estimated wait at `/waitlist/{ref}`.
- **Call** notifies the guest that their table is ready via the ticket page, browser push (if opted in), and email (if provided and SMTP is configured). **Seat** converts the entry into a standard booking on the smallest available table that fits.
- Wait estimates simulate the queue against the current floor: each table frees up when its active sitting ends, and each queued party is assigned the first suitable table for its party-size duration.
- When a party could be seated immediately but the simulation assigns the free table to a party ahead in the queue, the board flags it as `"Free now, skips #N"` (**API field:** `skipsNumber` on board entries).
- Unseated entries expire 6 hours after joining, and all waitlist entries are permanently deleted after 7 days for data minimization.
- Admin waitlist endpoints require the `bookings` scope; names and emails are redacted without `guests:read`. SMS notifications are not supported.

## Cover pacing

`maxCoversPerSlot` caps how many guests can **start** within a single booking slot (`null` disables the cap). Parties already seated from earlier slots do not count toward the current slot.

- Slots that a party would exceed are hidden from availability. If concurrent guests book the remaining seats, the later request fails with `booking.pacing_full` (`409`), including the cap and remaining capacity.
- Off-grid bookings count toward the slot they fall into (for example, `19:10` counts in `19:00`).
- Staff bookings and waitlist seating bypass the cap when created, but still count toward the slot total.
- Because the cap applies per slot, a 15-minute slot grid enforces a tighter arrival rate than a 30-minute grid.
- The admin overview includes `todayPacing` to populate the dashboard's **Arrivals per Slot Today** card.

## Booking horizon and party size limits

Four optional restaurant fields restrict online guest bookings. Each defaults to `null` (no limit), and staff bookings are exempt.

| Field                     | Range         | Behavior when violated                                                  | Error code (with payload field)            |
| ------------------------- | ------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| `maxBookingDaysAhead`     | `0–365` (`0` = today only) | Dates past the horizon show no slots                       | `booking.beyond_horizon` (`days`)          |
| `minBookingNoticeMinutes` | `1–10080` (up to 1 week)   | Slots inside the notice window are unavailable             | `booking.too_soon` (`minutes`)             |
| `minOnlinePartySize`      | `1–50`        | Parties below minimum see no slots                                      | `booking.party_below_online_min` (`min`)   |
| `maxOnlinePartySize`      | `1–50` (≥ min) | Parties above maximum see no slots; form prompts guest to contact venue | `booking.party_above_online_max` (`max`)   |

- Availability, holds, and booking creation all enforce these limits.
- **API (`PUT /api/restaurants/{id}`):** All four fields are always written on update (`null` clears a limit, matching `maxCoversPerSlot`). Out-of-range values return `restaurant.booking_horizon_invalid`, `restaurant.booking_notice_invalid`, or `restaurant.online_party_size_invalid`.
- **CLI:** `openresto locations update <id> --max-days-ahead 30 --min-notice 120 --min-party 2 --max-party 8` (pass `none` to clear a limit; the command reads the location first so other settings stay unchanged).

## Pausing bookings

Pausing closes sittings that **start** inside the pause window (stopping new arrivals temporarily rather than closing future days). Reservations for later in the evening or future dates remain open, and guests see the local time when the pause ends.

- **API:** `POST /api/admin/restaurants/{id}/pause` accepts either `{ "minutes": n }` (at least `1`) or `{ "until": "endOfService" }`.
- `endOfService` pauses bookings until the end of the current or next service today in the location's timezone (or yesterday's service if it runs past midnight).
- The response returns `bookingsPausedUntil` (UTC).
- **Error codes:** `restaurant.pause_request_invalid` (neither or both fields supplied), `restaurant.no_service_left_today` (`400`, when today is closed or service has already ended).
- **CLI:** `openresto locations pause <id> --rest-of-today`.

## Tables and combinable groups

- **Seating choice:** Guests pick **Any section** or a specific section, then **Any table** or a specific table. When no table is specified, the server auto-assigns the best available fit across the location (for **Any section**) or within the chosen section (using only groups whose tables all belong to that section).
- **Section-only mode:** Set `guestsChooseTable` to `false` on the restaurant to prevent guests from picking specific tables or groups. Online holds or bookings that specify one fail with `booking.table_choice_disabled` (`400`). Staff bookings and the waitlist are unaffected.
- **Combinable groups:** Define tables that can be joined for larger parties. A group's capacity must exceed its largest member table and not exceed the sum of its member tables. Individual member tables remain bookable separately. Auto-assign prefers standalone tables first, then individual tables in groups, then combined groups.
- Booking a group blocks all of its member tables, and booking any member table blocks the group.
- Deleting or resizing a member table shrinks the group's capacity to match, or removes the group if fewer than two tables remain.
- **Oversize cap:** `maxTableOversizeSeats` on the restaurant caps how many empty seats an auto-assigned table may have above the party size.
- **Deletion behavior:** Deleting a table or section preserves existing bookings and clears their table/section references. The confirmation prompt reports how many upcoming bookings are affected.
- **Seat counts:** Must be between `1` and `50`.

## Booking references

- **Formats (configured per location):** **Word** (default) appends four random digits (e.g., `crispy-basil-thyme-0482`); **Numeric** is 8 digits with no leading zero.
- Generated with a cryptographically secure random number generator. Previously issued references continue working even if the location's format is changed later.
- **Rate limit:** Guest reference endpoints (lookup, cancel, reminders, waitlist tickets) are limited to 10 requests/minute per IP to prevent guessing. Ensure your reverse proxy forwards `X-Forwarded-For` (see [HTTPS](/self-hosting/https/)) so guests do not share one IP quota.

## Locations: archive and delete

Deleting a location permanently removes its sections, tables, and bookings, so the server requires archiving a location before it can be deleted. Archived locations can be restored in one click. Only Owners can delete locations. `GET /api/admin/restaurants/{id}/delete-preview` returns the section, table, and booking counts shown before confirmation.

## Contact details

A location's phone number and email override brand-wide defaults **per field**: if a location sets only a phone number, it still inherits the brand email. Social links are configured brand-wide only.

## Admin accounts and roles

- **Owner:** Full access, including user management, API keys, the activity log, website widget settings, and deleting locations.
- **Manager:** Manages bookings, locations, tables, sections, and brand settings.
- At least one active Owner must exist at all times. Users cannot deactivate themselves or change their own role.
- The initial Owner account is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first boot.

## Activity log

Every change made through the admin UI or an API key, including rejected attempts and failed sign-ins, is logged under **Activity** (Owner-only). API key requests record the key's name.

- Passwords, secrets, and guest personal details (names, emails, phone numbers) are excluded; bookings are identified by booking reference.
- Entries cannot be edited or manually deleted. Old entries are purged automatically after `Audit:RetentionDays` (default `365`).

## Website widget

Embed the booking form on your own website; see [Booking widget for your website](/guides/booking-widget/).

- **API:** `GET` and `PUT /api/admin/embed-settings` read and replace `allowedOrigins` (Owner-only, browser session only; not writable via API keys). Origins are normalized to lower-case `scheme://host[:port]`.
- **Error codes:** `embed.origin_invalid` (`400`, origin contains a path, query, or wildcard), `embed.too_many_origins` (`400`, more than 20 origins).

## Autosave

Brand and location settings autosave 800 ms after you stop typing, with a 10-second undo window. Invalid values are not submitted and display inline validation feedback. SMTP configuration, password changes, booking edits, and deletions require an explicit button press.

## Language

OpenResto supports English (`en`), French (`fr`), Spanish (`es`), and German (`de`). Locale resolution checks the visitor's own selection first, then the instance default (`OPENRESTO_DEFAULT_LOCALE` or `Locale:Default`), then English. The native app also follows the device language.

## Configuration reference

| Setting                                                                           | Purpose                                                               |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `OPENRESTO_DEFAULT_LOCALE` / `Locale:Default`                                     | Default language (`en`, `fr`, `es`, `de`)                             |
| `Audit:RetentionDays`                                                             | Days to retain activity log entries (default `365`)                   |
| `GuestPush__ReminderLeadHours`                                                    | Reminder lead times before a booking, in hours (default `24,2`)       |
| `Wallet__Apple__*`, `Wallet__Google__*`                                           | Wallet pass issuer settings; see [native app guide](/guides/native-app/) |
| `Vapid__*`                                                                        | Web Push keys for admin notifications and browser reminders           |
| `OPENRESTO_CLI_PACKAGE_URL`, `OPENRESTO_API_DOCS_URL`, `OPENRESTO_REPOSITORY_URL` | Outbound links on the API Keys screen (for forks)                     |
| `WEBSITE_URL`                                                                     | Public URL used in email links when not set in brand settings         |
