# Feature reference

How OpenResto's booking features behave, and the API fields, error codes and settings behind
them. [`CHANGELOG.md`](../CHANGELOG.md) says when each one arrived; this page says how it
works. For calling the API see [`http-api.md`](http-api.md); for the native app, reminders
and Wallet passes see [`native-app.md`](native-app.md).

Error codes below come back in the `code` field of a rejected request, alongside a message in
the caller's language.

## Opening hours and schedules

- **Per-day hours.** Each day of the week can have its own open and close times. A service
  that closes after midnight belongs to the day it opened, so Saturday's 18:00–02:00 slots are
  Saturday's.
- **Slot interval.** Bookings start on a 15, 30 or 60 minute grid (default 30), separate from
  how long a booking lasts.
- **Schedule conflicts.** Narrowing hours, dropping an open day or changing the timezone never
  touches existing bookings. The Locations page lists upcoming bookings that no longer fit, and
  the dashboard shows the total. A walk-in-only day does not count as a conflict, because the
  location is still open. `openresto locations conflicts` lists them from the CLI.
- **Timezone changes.** Bookings are stored in UTC, so the guest is still expected at the same
  real moment, and the local time in their confirmation email is now wrong. Nothing is
  re-sent; the admin shows a warning when the location has upcoming bookings.

## Booking length (turn times)

A location has a default booking length. Turn-time rules give larger parties longer: each rule
is a party size and a length, and a party gets the rule with the largest party size at or
below its own. A party smaller than every rule gets the default.

- API: `turnTimes` on the restaurant, e.g. `[{ "minSeats": 3, "minutes": 90 }]`. On update,
  `null` leaves the rules alone and `[]` clears them.
- Availability, holds, auto-assign, admin bookings, waitlist seating and wait estimates all use
  the party's own length. Because of that, a hold request includes the party size.
- An existing booking keeps the length it was booked with.

## Booking status

Status is recorded alongside cancellation, not instead of it. A booking moves forward
through **Booked → Arrived → Seated → Finished**, or **Booked → No-show**.

- No-show is only offered once the sitting has started.
- The last change can be undone for 5 minutes.
- Finishing early or marking a no-show ends the sitting at that moment, so the table is free
  for availability, holds and the waitlist. Undoing restores the original end time.
- Parties seated from the waitlist start as Seated.
- In the bookings list, an unmarked booking reads **Due** once its sitting starts and
  **Unmarked** once it ends.
- A guest's no-show count is worked out from their bookings under the same email, across every
  location. It is never stored, so the GDPR purge removes it with the bookings.
- Guests never see status, and nothing is charged or blocked for a no-show.

API: `POST /api/admin/bookings/{id}/status` with `{ "status": "Seated" }` (`bookings:write`,
audited as `booking.status`). Admin booking reads carry `status`, `nextStatuses`,
`undoStatus` and `previousNoShows`; the last is withheld from keys without `guests:read`.
`status=noshow` filters the list.

## Walk-ins

- **Walk-in-only location or days.** The location stays listed, but online booking is
  replaced by a walk-in notice. Holds and bookings are refused and availability is empty.
  Staff can still record bookings from the admin.
- **Walk-in-only table.** One table is kept for the door every day. It is never offered
  online, auto-assign skips it, and a booking or hold that names it is refused with
  `table.walk_in_only` (409). A combinable group containing it is held back too. Staff and
  the waitlist can still seat it. API: `walkInOnly` on tables.

## Walk-in waitlist

Available online while a location is walk-in-only and open. Staff can add parties at the door
on any day.

- The guest picks a party size, sees the estimated wait, and leaves a name and optionally an
  email. Their ticket shows their place in the queue and the estimated wait, and has its own
  page at `/waitlist/{ref}`.
- **Call** tells the guest their table is ready: on the ticket, by push if they opted in, and by
  email if they left an address and SMTP is configured. **Seat** turns the entry into a normal
  booking on the smallest free table that fits.
- Estimates replay the queue against the floor: each table frees when its current sitting ends,
  and each party takes the first suitable table to free up, for a sitting of its own length.
- An entry still waiting 6 hours after joining expires. Every entry is deleted after 7 days,
  since it holds a name and email.
- Admin endpoints are under the `bookings` scope, with names and emails withheld from keys
  without `guests:read`. There is no SMS.

## Cover pacing

`maxCoversPerSlot` caps how many guests can **start** in one booking slot (`null` is no cap).
Parties already seated from an earlier slot don't count.

- A slot the party would overfill is not offered. A booking that loses a race for the last seats
  is refused with `booking.pacing_full` (409), including the cap and how many seats remain.
- A booking at an off-grid time counts in the slot it falls in (19:10 counts in 19:00).
- Staff bookings and waitlist seating aren't limited, but still count toward the total.
- The cap is per slot, so a location on a 15-minute grid gets a tighter limit than one on 30.
- The admin overview carries `todayPacing` for the dashboard's "Arrivals per Slot Today" card.

## Pausing bookings

A pause closes sittings that **start** inside the pause window. It means "stop seating new
arrivals for the next hour", not "stop taking bookings". Bookings for later tonight or next
week are unaffected, and the refusal names the local time the pause ends.

## Tables and combinable groups

- **Groups** mark tables that can be pushed together. A group seats more than its largest
  table and no more than the total of its tables. Each table in a group can still be booked on
  its own; auto-assign fills single tables first, then grouped tables, then groups.
- Booking a group blocks each of its tables, and booking one of its tables blocks the group.
- Deleting or resizing a table in a group shrinks the group to fit, or removes it if fewer
  than two tables are left.
- **Oversize cap.** `MaxTableOversizeSeats` limits how much bigger than the party an
  auto-assigned table can be.
- Deleting a table or section keeps its bookings and clears their table or section. The delete
  confirmation shows how many upcoming bookings are affected.
- Seat counts are 1–50.

## Booking references

- The **word** format (default) ends in four random digits: `crispy-basil-thyme-0482`. The
  **numeric** format is 8 digits with no leading zero. It is set per location.
- References are generated with a cryptographically secure random number generator. Every
  reference ever issued still resolves, whatever the location's current format.
- Guest endpoints that take a reference (lookup, cancel, reminders, waitlist tickets) are
  limited to 10 requests per minute per IP. Deployments where many guests share one IP
  should raise this in front of the app.

## Locations: archive and delete

Deleting a location removes its sections, tables and bookings, so it must be archived first.
The server refuses to delete an active location. Restoring an archived location is one press.
Deleting is Owner-only, and `GET /api/admin/restaurants/{id}/delete-preview` returns the
counts shown in the confirmation.

## Contact details

A location's phone and email override the brand-wide defaults **per field**, so a location
that lists only a phone still shows the brand email. Social links are brand-wide only.

## Admin accounts and roles

- **Owner** can also manage users, API keys and the activity log, and delete locations.
  **Manager** can do everything else.
- There must always be one active Owner. You can't deactivate yourself or change your own
  role.
- The first account is created from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on first start.

## Activity log

Every change made through the admin or an API key is recorded at **Activity** (Owner only),
including refused attempts and failed sign-ins. Entries name the API key when one was used.

- Entries never hold passwords, secrets or guest names, emails or phone numbers. Bookings are
  referred to by reference.
- There is no way to edit or delete entries. They are removed after `Audit:RetentionDays`
  (default 365).

## Autosave

Brand and location settings save 800 ms after you stop typing, with a 10-second undo.
Values the server would reject aren't sent, and the form says why. SMTP settings, password
changes, booking edits and deletes still need an explicit press.

## Language

English, French, Spanish and German. The language used is the visitor's own choice, then the
instance default (`OPENRESTO_DEFAULT_LOCALE` or `Locale:Default`), then English. The native
app also follows the phone's language.

## Configuration reference

| Setting                                                                           | Purpose                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `OPENRESTO_DEFAULT_LOCALE` / `Locale:Default`                                     | Default language (`en`, `fr`, `es`, `de`)                    |
| `Audit:RetentionDays`                                                             | Days to keep activity log entries (default 365)              |
| `GuestPush__ReminderLeadHours`                                                    | Reminder times before a booking, in hours (default `24,2`)   |
| `Wallet__Apple__*`, `Wallet__Google__*`                                           | Wallet pass issuers, see [`native-app.md`](native-app.md)    |
| `Vapid__*`                                                                        | Web Push keys for admin notifications and browser reminders  |
| `OPENRESTO_CLI_PACKAGE_URL`, `OPENRESTO_API_DOCS_URL`, `OPENRESTO_REPOSITORY_URL` | Where the API Keys screen links, for forks                   |
| `WEBSITE_URL`                                                                     | Public address for email links, if not set in brand settings |
