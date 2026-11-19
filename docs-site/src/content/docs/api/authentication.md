---
title: Calling the API with an API key
description: Create an API key, send it with requests, and pick the smallest set of permissions.
---

This guide covers calling the OpenResto admin API directly over HTTP using an API key. While [`openresto-cli`](https://www.npmjs.com/package/openresto-cli) provides a terminal client, it is optional. Any HTTP client (`curl`, a cron script, a Zapier webhook, or a custom backend) can call the same endpoints by passing the key in a request header.

The examples below assume your server runs at `https://bookings.example.com`. Replace it with your own origin. The API is served under `/api` on the same origin as the admin UI.

## 1. Create a key

In the admin UI, go to **Settings → API Keys** (Owner role required) and click **Add API key**. Give it a descriptive name for the integration that will use it and grant only the scopes it needs.

The secret (`orst_<id>_<secret>`) is shown once upon creation. The server stores only a hash and cannot display it again, so store it like a password.

Keys belong to the user who created them: you can only view, create, and revoke your own keys. Revocation is immediate and permanent. To rotate a key, create a new one, update your integration, and revoke the old one.

## 2. Authenticate requests

Send the raw secret in the `X-API-Key` header. Do not use the `Authorization` header: that header is reserved for browser-session JWTs, and API keys sent there are ignored.

```bash
curl -H "X-API-Key: orst_1_your-secret" \
  https://bookings.example.com/api/admin/bookings
```

To verify a key and inspect its scopes, call `/api/admin/api-keys/self`. Every valid key can reach this endpoint regardless of its scopes. If it returns `401`, check that the full secret was copied and sent in `X-API-Key`.

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

## 3. Read and write data

Query parameters, request bodies, and response shapes are identical to those used by the admin UI.

```bash
# Today's bookings at location 2
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  "https://bookings.example.com/api/admin/bookings?restaurantId=2&date=2026-01-31"

# Cancel a booking
curl -X POST -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/bookings/57/cancel

# Record a booking taken over the phone
curl -X POST -H "X-API-Key: $OPENRESTO_API_KEY" -H "Content-Type: application/json" \
  -d '{"restaurantId":2,"sectionId":3,"tableId":11,"seats":2,
       "date":"2026-01-31T19:00:00Z","customerEmail":"ada@example.com","customerName":"Ada"}' \
  https://bookings.example.com/api/admin/bookings
```

The [API reference](/api/reference/) documents every endpoint, parameter, and response schema. It is generated from the running API and checked in CI for drift. You can also import the committed OpenAPI specification at [`openresto-cli/openapi/v1.json`](https://github.com/karanshukla/openresto/blob/main/openresto-cli/openapi/v1.json) into Postman, Insomnia, or a client generator.

## Permissions

Every admin endpoint requires a `{resource}:{access}` scope. Grant the smallest set your integration needs.

| Resource    | Access         | Covers                                                    |
| ----------- | -------------- | --------------------------------------------------------- |
| `bookings`  | `read`/`write` | Reservations, their details, and the walk-in waitlist     |
| `locations` | `read`/`write` | Restaurants, opening hours, and location settings         |
| `tables`    | `read`/`write` | Sections, tables, and combinable groups                   |
| `brand`     | `read`/`write` | Site name, colours, contact details, highlights, and media |
| `users`     | `read`/`write` | List accounts; `write` activates and deactivates them     |
| `audit`     | `read`         | The admin activity trail                                  |
| `guests`    | `read`         | Customer names and emails on bookings and the waitlist    |
| `email`     | `read`         | Whether outgoing mail is configured and delivering        |

A `write` grant includes `read`, but `read` does not include `write`. Because `audit`, `guests`, and `email` are read-only, `audit:write`, `guests:write`, and `email:write` are rejected when creating a key.

### Guest identity redaction (`guests:read`)

The `guests` scope controls data visibility rather than endpoint access. A key with `bookings:read` but without `guests:read` still receives every booking, with customer names and emails blanked. The same redaction applies to recipient addresses on email delivery failures. Grant `guests:read` only when the integration needs to identify guests.

### Email delivery checks (`email:read`)

Booking confirmations are sent on a best-effort basis: if delivery fails, the failure is logged and the booking still succeeds. Use the `email:read` endpoints to verify that guests are receiving mail:

```bash
# Check whether SMTP is configured and confirmations are enabled
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/email-settings/status

# List recent delivery failures
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/email-settings/failures

# Render a preview of the guest confirmation email (nothing is sent)
# Add ?restaurantId=<id> to preview a location other than the first
curl -H "X-API-Key: $OPENRESTO_API_KEY" \
  https://bookings.example.com/api/admin/email-settings/preview
```

### Browser-only actions

Some admin actions require an interactive browser session and cannot be called with any API key:

- Auth self-service (changing your password, email, or security question)
- SMTP settings (no `email:write` scope exists, preventing a leaked key from rewriting SMTP credentials to intercept mail)
- Push notification settings
- API key management
- Creating user accounts, changing roles, or resetting passwords (`users:write` is limited to activating and deactivating accounts so a key cannot create an interactive login and escalate beyond its scopes)

## Key behavior and limits

- **Guest endpoints do not require a key:** Browsing locations, checking availability, holding tables, and creating guest bookings are public. Passing an API key has no effect on them.
- **Keys inherit the creator's account role:** The underlying user account is checked on every request. Demoting or deactivating that account narrows or disables its keys immediately.
- **All calls are audited:** Changes appear in the admin activity trail under the key's name (which is why every key requires a name). Read the trail with `GET /api/admin/audit` (`audit:read`).

## Responses and errors

Successful calls return `200` or `201` with a JSON body. Errors return a JSON object containing a `message` and usually a machine-readable `code`:

| Status | Meaning                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------- |
| `401`  | Missing, unknown, revoked, or expired key, or the underlying account is inactive                      |
| `403`  | Valid key missing a required scope (e.g., `This API key is missing the 'bookings:write' scope.`)      |
| `404`  | Record not found                                                                                      |
| `409`  | Conflict with existing state (for example, an overlapping booking or a full table)                    |
| `429`  | Rate limit exceeded                                                                                   |

Requests with an API key receive a higher rate limit than unkeyed traffic (1000 requests/minute per client IP in production, compared to 300/minute for unkeyed requests). The limit is evaluated before key validation and tracked per client IP, so retrying rejected requests from the same host counts against the limit. Wait before retrying after a `429`.

## Handling the secret

- **Keep secrets out of URLs and command arguments:** Process arguments are visible to other users on the machine via `ps`. Pass keys via environment variables (`$OPENRESTO_API_KEY`) or a secrets file.
- **Use one key per integration:** Separate keys allow individual revocation and make the activity trail clear about which caller made each change.
- **Set an expiry:** Configure an expiration date unless the integration has a separate rotation process.
- **Always use HTTPS:** An API key is a bearer credential; anyone who intercepts the header can use it until it is revoked.

## See also

- [`openresto-cli`](https://github.com/karanshukla/openresto/tree/main/openresto-cli): Official CLI client with named profiles, hidden-input login, and table or `--json` output.
- [API reference](/api/reference/): Complete endpoint, parameter, and response documentation generated from the OpenAPI spec.
