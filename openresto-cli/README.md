# openresto-cli

A command-line client for the OpenResto admin API, authenticated with an
[admin API key](https://github.com/karanshukla/openresto/blob/main/OpenRestoApi/Controllers/ApiKeysController.cs)
rather than a browser session.

[OpenResto](https://github.com/karanshukla/openresto) is a self-hosted restaurant booking system: guests browse locations, hold a
table in real time and book; staff run reservations, tables, sections and branding from an admin
dashboard. This CLI drives that same admin API from a terminal. If you don't have a server yet,
start at the [main repository](https://github.com/karanshukla/openresto#readme).

This isn't its own product, it's an extension of OpenResto, so its version tracks the main
project's on every release. Pick the release that matches your server.

Nothing about the API requires this client: the same key works on a plain HTTP request from a
script or your own backend. See
[`docs/http-api.md`](https://github.com/karanshukla/openresto/blob/main/docs/http-api.md) for
that route.

## Install

### npm (recommended)

```bash
npx openresto-cli@1.9.0 --help      # no install
npm install -g openresto-cli@1.9.0  # or put `openresto` on your PATH
```

Requires Node 24+. Installing globally is what gives you the `openresto` command and a
persistent profile at `~/.config/openresto/config.json`, so it's the option to use if you run
more than the occasional one-off command.

### Docker

```bash
docker run --rm \
  -e OPENRESTO_URL=https://booking.example.com \
  -e OPENRESTO_API_KEY=orst_1_your-secret \
  ghcr.io/karanshukla/openresto-cli:<tag> bookings list
```

Use `latest` for the newest release, or pin a specific version (e.g. `1.9.0`) to match your
server. Env vars are the simplest way to configure a one-off container since there's no
persistent home directory; to use saved profiles (`~/.config/openresto/config.json`) instead,
mount a config directory across runs:

```bash
docker run --rm -it -v openresto-cli-config:/home/node/.config/openresto \
  ghcr.io/karanshukla/openresto-cli:<tag> auth login
docker run --rm -v openresto-cli-config:/home/node/.config/openresto \
  ghcr.io/karanshukla/openresto-cli:<tag> bookings list
```

(`auth login` needs `-it` so its hidden-input prompt has a real terminal; later commands don't.)

Use this when the machine has Docker but no Node 24.

### From source

```bash
git clone https://github.com/karanshukla/openresto.git
cd openresto/openresto-cli
npm install
npm run build
npm link   # optional: puts `openresto` on your PATH
```

Or run it straight from source without linking:

```bash
node dist/index.js --help
```

Requires Node 24+.

## Set up an API key and log in

1. In the admin UI, go to **Settings → API Keys** (Owner role required) and create a key. Give
   it only the scopes you actually need — see [Scopes](#scopes) below — and copy the secret
   (`orst_<id>_<secret>`); it is shown exactly once.
2. Log the CLI in:

   ```bash
   openresto auth login
   Server URL: https://booking.example.com
   API key: ••••••••••••••••••••••••••••••••••
   Saved profile "default" for https://booking.example.com.
   ```

   **The key is never accepted as a command-line argument** — the same reason
   [`scripts/demo_data.py`](https://github.com/karanshukla/openresto/blob/main/scripts/demo_data.py) won't take a password on argv:
   anything passed as `argv` is visible to
   every other process on the machine via `ps`. `auth login` either prompts for it with the
   terminal's input hidden, or reads it from stdin when piped, e.g. in a script:

   ```bash
   printf '%s' "$OPENRESTO_KEY" | openresto auth login --url https://booking.example.com
   ```

3. Confirm it works:

   ```bash
   openresto auth whoami
   ```

`auth login` and `auth whoami` also check the server's version against the CLI's own (major.minor
only — a patch difference is expected and silent) and print a one-line `warning:` to stderr on a
mismatch, e.g. `warning: server is 1.8.0, CLI is 1.9.0 — commands may not match the server's API`.
A self-hosted server can lag behind the CLI it's paired with, so this is advisory, not fatal — it
never fails the command it's attached to, and it never appears in `--json` output since it always
goes to stderr. An older server that predates this check (no `/api/version` endpoint) gets its own
"server version is unknown" warning instead of a silent skip.

## Profiles

Multiple servers/keys can be saved as named profiles in `~/.config/openresto/config.json`
(written at mode `0600`):

```bash
openresto --profile staging auth login
openresto --profile staging bookings list
```

Environment variables always win over a stored profile, field by field — useful for CI or a
one-off override without touching the saved config:

| Variable            | Overrides                                  |
| ------------------- | ------------------------------------------ |
| `OPENRESTO_URL`     | the profile's server URL                   |
| `OPENRESTO_API_KEY` | the profile's API key                      |
| `OPENRESTO_PROFILE` | which profile is active (like `--profile`) |

```bash
OPENRESTO_URL=https://booking.example.com OPENRESTO_API_KEY="$CI_OPENRESTO_KEY" \
  openresto bookings list --json
```

`openresto auth logout` removes the saved key for the active profile (the server URL stays, so
`auth login` next time only needs to ask for a new key).

## Output

Every command prints a human-readable table by default. Pass `--json` (before or after the
subcommand) for machine-readable output:

```bash
openresto bookings list --json | jq '.[] | select(.seats > 6)'
```

## Command groups

Run `openresto <group> --help` or `openresto <group> <command> --help` for full flag lists. One
example per group:

- **status** — the admin overview: booking totals, today's covers, paused locations and the
  schedule-conflict count. Server state, where `auth whoami` answers for the key itself.

  ```bash
  openresto status
  ```

- **auth** — `login`, `whoami`, `logout`.

  ```bash
  openresto auth whoami
  ```

- **bookings** — `list`, `get`, `create`, `update`, `extend`, `email`, `cancel`, `restore`,
  `purge`.

  ```bash
  openresto bookings list --location 1 --status upcoming
  openresto bookings extend 42 --minutes 30
  ```

  `purge` permanently deletes a booking (the GDPR purge path) and asks for confirmation; pass
  `--yes` to skip the prompt, which is required when stdin isn't a terminal (scripts/CI).

  `email` sends a one-off message to the guest on a booking. The body is multi-line, so it comes
  from a file or from stdin rather than a flag:

  ```bash
  openresto bookings email 42 --subject "Your table tonight" --body-file note.html
  printf 'Running 20 minutes late — see you soon.' | openresto bookings email 42 --subject "Update"
  ```

  On a server with no SMTP settings this fails with the code `email.not_configured` rather than a
  wrapped transport error, so a script can tell a permanent setup problem from a transient one.
  `openresto email status` answers the same question without sending anything.

- **availability** — `check` (public endpoint, no key needed for this one call, but the CLI
  still sends one if configured).

  ```bash
  openresto availability check --location 1 --date 2026-09-01 --seats 4
  ```

- **locations** — `list` (includes archived locations), `get`, `create`, `pause`, `unpause`,
  `extend`, `conflicts`, `archive`, `restore`, `delete`.

  ```bash
  openresto locations pause 1 --minutes 60
  openresto locations extend 1 --minutes 30   # every active booking: "we're running late"
  ```

  `conflicts` lists bookings stranded by a narrowed schedule — taken under opening hours, open
  days or a walk-in policy the location no longer runs. Editing a schedule deliberately leaves
  existing bookings alone, so this is how you find who needs calling.

  `delete` requires the location to already be archived (the server enforces this — see
  `RestaurantManagementService` — and the CLI surfaces that error with a pointer to run
  `locations archive` first) and shows a delete-preview (section/table/booking counts) before
  asking for confirmation.

- **tables** — `list` (a location's sections and tables together, since a table can't be
  created/edited/deleted without naming its section), `create`, `update`, `delete`. Use
  `tables list --location <id>` or `sections list --location <id>` to find a section's id, then
  pass it as `--section` to the other table commands.

  ```bash
  openresto tables list --location 1
  openresto tables create --location 1 --section 2 --name "T5" --seats 4
  ```

- **sections** — `list`, `create`, `update` (rename), `delete`. Reordering sections is left to
  the admin UI (no CLI command for it yet).

  ```bash
  openresto sections create --location 1 --name "Patio"
  openresto sections delete 2 --location 1
  ```

  `delete` removes the section's tables along with it; any upcoming bookings referencing the
  section or one of its tables keep their booking and only lose that reference (the server nulls
  the FK rather than cascading — see CLAUDE.md's "Deletion & cascade behaviour"). The CLI previews
  how many bookings that affects before asking for confirmation.

- **brand** — `get`, `set` (via flags, or `--from-json <file>` / `--from-json -` for stdin — an
  empty string clears a field, an omitted one leaves it unchanged, matching `PATCH /api/brand`).

  ```bash
  openresto brand set --app-name "My Restaurant" --primary-color "#0a7ea4"
  ```

- **users** — `list`, `create`, `role`, `reset-password`, `activate`, `deactivate`. Owner-only
  server-side; a key without the `users` scope (or one whose underlying account isn't an Owner)
  gets a clear 403.

  ```bash
  openresto users role 3 --role Manager
  openresto users reset-password 3          # prompts, hidden
  cat new-password.txt | openresto users reset-password 3
  ```

  `reset-password` takes no password flag, for the same reason `auth login` takes no key flag: an
  argument is visible to every other process on the host through `ps`.

- **audit** — `list`, with the same filters as the admin activity trail (`actorUserId`, an
  `action` prefix, `targetType`, `location`, `from`/`to`, `page`/`pageSize`). Owner-only.

  ```bash
  openresto audit list --action booking --from 2026-08-01
  ```

- **email** — `status`, `failures`. Read-only: the SMTP credentials are unreachable with an API
  key by design, so there is no `email set` to pair with these.

  ```bash
  openresto email status
  openresto email failures
  ```

  Booking confirmations are best-effort server-side — a send failure is recorded and the booking
  goes through regardless — so an integration creating bookings by key would otherwise never
  learn its guests are receiving nothing. `status` separates the two causes with the same visible
  effect: `isConfigured` false means no SMTP settings at all, `sendBookingConfirmations` false
  means they are configured but switched off. `failures` blanks the recipient address for a key
  without `guests:read`, the same redaction the booking endpoints apply.

## Scopes

Every admin endpoint the CLI calls is gated by a `{resource}:{access}` scope on the key
(`bookings`, `locations`, `tables`, `brand`, `users`, `audit`, `guests`, `email` × `read`/`write`;
a `write` grant also satisfies the matching `read` requirement). `audit`, `guests` and `email` are
read-only — there is no write level to mint. `email` in particular reaches only whether mail is
configured and what has failed to send: a key that could rewrite the SMTP host and credentials
would be able to redirect every outgoing mail to a relay it controls. **Mint the narrowest key that does
the job** — a read-only reporting script should get `bookings:read` and nothing else, never a
key with every resource at `write`. A 403 from the CLI names exactly which scope is missing
(`This API key is missing the 'bookings:write' scope.`), so widening a key later is a quick,
deliberate step rather than a guess made up front. `auth whoami` shows a key's own scopes at any
time.

## Development

These run inside a clone of the [OpenResto repository](https://github.com/karanshukla/openresto), not against the published package.

```bash
npm run typecheck   # tsc --noEmit
npm test            # builds, then runs the node:test suite in dist/
npm run build       # compile TypeScript to dist/
```

### Regenerating the transport types

`src/generated/api.d.ts` is generated from the backend's OpenAPI document
(`openresto-cli/openapi/v1.json`) via [`openapi-typescript`](https://openapi-ts.dev/). It types
the shape of requests/responses for the hand-written fetch transport (`src/transport.ts`) to lean
on — **generated operation names never dictate the CLI's command structure**; the command tree
above is designed by hand and mapped onto the real endpoints.

Both files are committed, and CI's `OpenAPI Drift` job
([`.github/workflows/ci.yml`](https://github.com/karanshukla/openresto/blob/main/.github/workflows/ci.yml)) fails if
either goes stale. To regenerate them after an API change:

```bash
# from the repo root
dotnet build
(cd tools/OpenApiExport && dotnet run --no-build -- ../../openresto-cli/openapi/v1.json)
(cd openresto-cli && npm run generate:types)
```

See [`tools/OpenApiExport/Program.cs`](https://github.com/karanshukla/openresto/blob/main/tools/OpenApiExport/Program.cs) for why the document is emitted by booting the API
in-process (`WebApplicationFactory`) rather than via MSBuild's build-time document generation.
