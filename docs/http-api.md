# Calling the OpenResto API with an API key

The [`openresto-cli`](https://www.npmjs.com/package/openresto-cli) wraps the admin API in a
terminal client, but nothing about the API needs it: an admin API key is presented on a plain
HTTP header, so `curl`, a cron script, a Zapier webhook or your own backend can call the same
endpoints. This page is the direct-HTTP path.

Everything below assumes your server is at `https://bookings.example.com`. Substitute your own
origin — the API lives under `/api` on the same origin the admin UI is served from.

## 1. Mint a key

In the admin UI, go to **Settings → API Keys** (Owner role required), press **Add API key**, name
it after the thing that will hold it, and grant the narrowest set of permissions that does the
job. The secret (`orst_<id>_<secret>`) is shown exactly once, on creation — the server stores only
a hash of it and can never show it again. Store it the way you store a password.

Keys are per-user and self-scoped: you see, mint and revoke only your own. Revoking is immediate
and permanent; there is no un-revoke, so rotation means minting a new key and deleting the old
one from wherever it is configured.

## 2. Present it

Send the raw secret on the `X-API-Key` header. **Not** `Authorization` — that header is for the
browser session's JWT, and a key sent there is ignored.

```bash
curl -H "X-API-Key: orst_1_your-secret" \
  https://bookings.example.com/api/admin/bookings
```

Confirm a key works, and see what it is allowed to do, with the one endpoint every key can reach
regardless of its scopes:

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

Query parameters, request bodies and responses are identical to the ones the admin UI uses — the
key only changes how the request authenticates.

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

The complete endpoint list, with every parameter and response shape, is the OpenAPI document
committed at [`openresto-cli/openapi/v1.json`](../openresto-cli/openapi/v1.json). It is generated
from the running API and CI fails if it drifts, so it is the reference — import it into Postman,
Insomnia, or your own client generator.

## Permissions

Every admin endpoint is gated on a `{resource}:{access}` scope:

| Resource    | Access         | Covers                                                    |
| ----------- | -------------- | --------------------------------------------------------- |
| `bookings`  | `read`/`write` | Reservations and their details                            |
| `locations` | `read`/`write` | Restaurants, opening hours and their settings             |
| `tables`    | `read`/`write` | Sections, tables and combinable groups                    |
| `brand`     | `read`/`write` | Site name, colours, contact details, highlights and media |
| `users`     | `read`/`write` | Admin accounts and their roles                            |
| `audit`     | `read`         | The admin activity trail                                  |
| `guests`    | `read`         | Customer names and emails on bookings                     |
| `email`     | `read`         | Whether outgoing mail is configured and delivering        |

A `write` grant satisfies a `read` requirement; the reverse is never true. `audit`, `guests` and
`email` are read-only, so `audit:write`, `guests:write` and `email:write` are rejected at mint
time rather than accepted as scopes nothing checks.

`guests` is a redaction, not a gate: a key with `bookings:read` but no `guests:read` still gets
every booking, with the customer's name and email blanked. Grant it only where the caller
genuinely needs to identify people. The same redaction covers the recipient on an email
delivery failure.

`email` answers whether guests are receiving anything at all. Booking confirmations are
best-effort — a send failure is recorded and the booking goes through regardless — so a script
creating bookings otherwise has no way to notice that none of them are being delivered:

```bash
# Is mail configured, and are confirmations switched on? Two causes, one visible effect.
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/email-settings/status

# Recent delivery failures
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/email-settings/failures
```

Some of the admin surface is deliberately out of reach of any key, no matter its scopes: auth
self-service (password, email, security question), the SMTP settings themselves, push
notifications, and API key management itself. Those need a browser session. There is no
`email:write` for the same reason: a key that could rewrite the SMTP host, username and password
would be a mail-interception tool sitting in a CI secret.

## What a key cannot do

- **The guest-facing endpoints need no key at all.** Browsing locations, checking availability,
  holding a table and booking are public; sending a key with them changes nothing.
- **Keys carry no role of their own.** A key resolves to the account that minted it, live on
  every request, so demoting or deactivating that account immediately narrows or kills the key.
- **Every call is audited.** Mutations land in the admin activity trail with the key's name
  attached, which is why the name is required at mint. `GET /api/admin/audit` (with `audit:read`)
  reads it back.

## Responses and errors

Success is a normal `200`/`201` with a JSON body. Failures are a JSON object carrying a `message`
and usually a machine-readable `code`:

| Status | Meaning                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------- |
| `401`  | Missing, unknown, revoked or expired key — or the account behind it is inactive                       |
| `403`  | Valid key, missing scope. The message names it: `This API key is missing the 'bookings:write' scope.` |
| `404`  | No such record                                                                                        |
| `409`  | The request conflicts with existing state (an overlapping booking, a full table)                      |
| `429`  | Rate limited                                                                                          |

Keyed requests get a higher rate-limit ceiling than browser traffic (1000/minute per client IP in
production, against 300 for unkeyed). The limiter runs before authentication and buckets on the
caller's IP, so retrying a rejected request from the same host will not find a fresh allowance —
back off instead.

## Handling the secret

- Keep it out of URLs and out of command arguments; anything on a process's argv is visible to
  every other user on the box via `ps`. Use an environment variable or a secrets file, as the
  examples above do with `$OPENRESTO_API_KEY`.
- Give each integration its own key. Shared keys cannot be revoked independently, and the audit
  trail cannot tell you which caller did what.
- Set an expiry unless the integration genuinely outlives the plan for rotating it.
- Serve the API over HTTPS. The key is a bearer credential: anything that can read the header can
  replay it until it is revoked.

## See also

- [`openresto-cli`](../openresto-cli/README.md) — the maintained client, if a terminal or a
  scripted host will do. It handles profiles, hidden-input login and pretty/JSON output.
- [`openresto-cli/openapi/v1.json`](../openresto-cli/openapi/v1.json) — the generated contract.
