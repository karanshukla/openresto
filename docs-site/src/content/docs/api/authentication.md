---
title: Calling the API with an API key
---

This page shows you how to call the OpenResto admin API directly over HTTP, using an API key.
The [`openresto-cli`](https://www.npmjs.com/package/openresto-cli) wraps the admin API in a
terminal client, but you don't need it. The key goes in a plain HTTP header, so `curl`, a cron
script, a Zapier webhook or your own backend can call the same endpoints.

The examples assume your server is at `https://bookings.example.com`. Swap in your own origin.
The API lives under `/api` on the same origin as the admin UI.

## 1. Mint a key

"Minting" a key just means creating it. In the admin UI, go to **Settings → API Keys** (Owner
role required) and press **Add API key**. Name it after the thing that will use it, and grant
only the permissions it needs. The secret (`orst_<id>_<secret>`) is shown once, when you create
it. The server stores only a hash of it, so it can't show it again. Store it the way you store a
password.

Keys belong to one user: you see, mint and revoke only your own. Revoking is immediate and
permanent. To rotate a key, mint a new one and delete the old one from wherever it is
configured.

## 2. Present it

Send the raw secret in the `X-API-Key` header. Don't use `Authorization`: that header is for the
browser session's JWT (a signed login token), and a key sent there is ignored.

```bash
curl -H "X-API-Key: orst_1_your-secret" \
  https://bookings.example.com/api/admin/bookings
```

To check that a key works and see what it can do, call the one endpoint every key can reach,
whatever its scopes. If you get a `401`, check that the key is copied in full and sent in
`X-API-Key`.

```bash
curl -H "X-API-Key: orst_1_your-secret" \
  https://bookings.example.com/api/admin/api-keys/self
```

```json
{
  "id": 1,
  "name": "Reservations widget",
  "prefix": "orst_1_A1b2C3d4E",
  "scopes": [{ "resource": "bookings", "access": "read" }],
  "createdAt": "2026-01-04T10:12:33Z",
  "lastUsedAt": "2026-01-31T08:02:11Z",
  "expiresAt": "2027-01-04T10:12:33Z",
  "revokedAt": null,
  "userId": 1,
  "email": "owner@example.com",
  "role": "Owner"
}
```

## 3. Read and write

Query parameters, request bodies and responses are the same as the ones the admin UI uses. The
key only changes how the request signs in.

```bash
# Today's bookings at location 2
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  "https://bookings.example.com/api/admin/bookings?restaurantId=2&date=2026-01-31"

# Cancel one
curl -X POST -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/bookings/57/cancel

# Record one taken over the phone
curl -X POST -H "X-API-Key: $OPENRESTO_API_KEY" -H "Content-Type: application/json" \
  -d '{"restaurantId":2,"sectionId":3,"tableId":11,"seats":2,
       "date":"2026-01-31T19:00:00Z","customerEmail":"ada@example.com","customerName":"Ada"}' \
  https://bookings.example.com/api/admin/bookings
```

The [API reference](/api/reference/) lists every endpoint, with all parameters and response
shapes. It is generated from the running API, and CI fails if it drifts, so you can rely on it.
The same OpenAPI document is committed at
[`openresto-cli/openapi/v1.json`](https://github.com/karanshukla/openresto/blob/main/openresto-cli/openapi/v1.json)
if you want to import it into Postman, Insomnia or your own client generator.

## Permissions

Every admin endpoint needs a `{resource}:{access}` scope. Pick the smallest set your integration
needs.

| Resource    | Access         | Covers                                                    |
| ----------- | -------------- | --------------------------------------------------------- |
| `bookings`  | `read`/`write` | Reservations, their details and the walk-in waitlist      |
| `locations` | `read`/`write` | Restaurants, opening hours and their settings             |
| `tables`    | `read`/`write` | Sections, tables and combinable groups                    |
| `brand`     | `read`/`write` | Site name, colours, contact details, highlights and media |
| `users`     | `read`/`write` | List accounts; `write` activates and deactivates them     |
| `audit`     | `read`         | The admin activity trail                                  |
| `guests`    | `read`         | Customer names and emails on bookings and the waitlist    |
| `email`     | `read`         | Whether outgoing mail is configured and delivering        |

A `write` grant also covers `read`, but not the other way round. `audit`, `guests` and `email`
are read-only, so `audit:write`, `guests:write` and `email:write` are rejected when you create
the key.

`guests` hides data rather than blocking access. A key with `bookings:read` but no
`guests:read` still gets every booking, with the customer's name and email blanked. Grant
`guests:read` only where the caller needs to identify people. The same blanking applies to the
recipient on an email delivery failure.

`email` tells you whether guests are receiving anything at all. Booking confirmations are
best-effort: if a send fails, the failure is recorded and the booking still goes through. So a
script that creates bookings has no other way to notice that none of them are being delivered:

```bash
# Is mail configured, and are confirmations switched on? Two causes, one visible effect.
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/email-settings/status

# Recent delivery failures
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/email-settings/failures

# The confirmation a guest would receive, rendered from a stand-in booking. Nothing is sent.
# Add ?restaurantId=<id> to render a location other than the first.
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/email-settings/preview
```

Some admin features are out of reach of any key, whatever its scopes. These are auth
self-service (password, email, security question), the SMTP settings themselves, push
notifications, API key management itself, and creating an account, changing a role or resetting
a password. Those need a browser session. There is no `email:write` for the same reason: a key
that could rewrite the SMTP host, username and password could be used to intercept mail, and it
would be sitting in a CI secret.

The three excluded `users` actions follow the same logic. A key that could create a login, or
take over an existing one, wouldn't be limited by its scopes at all. Its holder could sign in to
the admin UI as that account and reach every endpoint above, including minting themselves an
unscoped key. Limiting which role a key may create wouldn't fix this, because that part of the
admin is open to any admin, not only an Owner, so a Manager login is enough. That is why
`users:write` covers activation only, which doesn't start a session.

## What a key cannot do

- **Guest-facing endpoints need no key.** Browsing locations, checking availability, holding a
  table and booking are public. Sending a key with them changes nothing.
- **Keys have no role of their own.** A key uses the account that created it, checked on every
  request. If you demote or deactivate that account, the key is narrowed or stops working
  straight away.
- **Every call is audited.** Changes appear in the admin activity trail with the key's name
  attached, which is why a name is required when you create a key. Read the trail back with
  `GET /api/admin/audit` (needs `audit:read`).

## Responses and errors

A success is a normal `200` or `201` with a JSON body. A failure is a JSON object with a
`message` and, usually, a machine-readable `code`:

| Status | Meaning                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------- |
| `401`  | Missing, unknown, revoked or expired key, or the account behind it is inactive                        |
| `403`  | Valid key, missing scope. The message names it: `This API key is missing the 'bookings:write' scope.` |
| `404`  | No such record                                                                                        |
| `409`  | The request conflicts with existing state (an overlapping booking, a full table)                      |
| `429`  | Rate limited                                                                                          |

Keyed requests get a higher rate limit than browser traffic (1000/minute per client IP in
production, against 300 for unkeyed). The limit is checked before the key is read and counted per
caller IP, so retrying a rejected request from the same host won't give you a fresh allowance.
If you get a `429`, wait a little before trying again.

## Handling the secret

- Keep it out of URLs and command arguments. Anything in a process's arguments is visible to
  every other user on the machine via `ps`. Use an environment variable or a secrets file, as
  the examples above do with `$OPENRESTO_API_KEY`.
- Give each integration its own key. A shared key can't be revoked separately, and the audit
  trail can't tell you which caller did what.
- Set an expiry, unless the integration will outlast your plan for rotating the key.
- Serve the API over HTTPS. The key is a bearer credential: anything that can read the header can
  reuse it until it is revoked.

## See also

- [`openresto-cli`](https://github.com/karanshukla/openresto/tree/main/openresto-cli): the maintained client, if a terminal or a
  scripted host will do. It handles profiles, hidden-input login and pretty/JSON output.
- [API reference](/api/reference/): every endpoint, parameter and response, generated from the API's OpenAPI document.
