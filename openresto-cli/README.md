# openresto-cli

A command-line client for the OpenResto admin API, authenticated with an [admin API key](https://github.com/karanshukla/openresto/blob/main/OpenRestoApi/Controllers/ApiKeysController.cs) instead of a browser session.

[OpenResto](https://github.com/karanshukla/openresto) is a self-hosted restaurant booking system: guests browse locations, hold tables in real time, and book, while staff manage reservations, tables, sections, and branding from an admin dashboard. This CLI calls the same admin API from a terminal. If you do not have a server running yet, start at the [main repository](https://github.com/karanshukla/openresto#readme).

`openresto-cli` is versioned alongside the main OpenResto project on every release. Install the version that matches your server.

The API does not require this client: the same API key works in plain HTTP requests from scripts or custom backends. See the [HTTP API guide](https://docs.openres.to/api/authentication/) for direct HTTP usage.

## Install

### npm (recommended)

```bash
npx openresto-cli@1.9.0 --help      # run without installing
npm install -g openresto-cli@1.9.0  # install `openresto` globally on PATH
```

Requires Node 24+. A global install provides the `openresto` command and stores persistent profiles in `~/.config/openresto/config.json`.

### Docker

```bash
docker run --rm \
  -e OPENRESTO_URL=https://booking.example.com \
  -e OPENRESTO_API_KEY=orst_1_your-secret \
  ghcr.io/karanshukla/openresto-cli:<tag> bookings list
```

Use `latest` for the newest release, or pin a specific tag (such as `1.9.0`) to match your server. Use this option when Docker is available and Node 24 is not.

Environment variables are the simplest option for one-off containers because containers do not keep a persistent home directory. To use saved profiles (`~/.config/openresto/config.json`) across runs, mount a volume:

```bash
docker run --rm -it -v openresto-cli-config:/home/node/.config/openresto \
  ghcr.io/karanshukla/openresto-cli:<tag> auth login
docker run --rm -v openresto-cli-config:/home/node/.config/openresto \
  ghcr.io/karanshukla/openresto-cli:<tag> bookings list
```

`auth login` requires `-it` so the hidden-input prompt has an interactive terminal; later commands do not.

### From source

Requires Node 24+.

```bash
git clone https://github.com/karanshukla/openresto.git
cd openresto/openresto-cli
npm install
npm run build
npm link   # optional: puts `openresto` on your PATH
```

To run without linking:

```bash
node dist/index.js --help
```

## Set up an API key and log in

1. In the admin UI, go to **Settings → API Keys** (Owner role required) and create a key. Grant only the scopes needed (see [Scopes](#scopes)) and copy the secret (`orst_<id>_<secret>`), which is displayed once.

2. Log in with the CLI:

   ```bash
   openresto auth login
   Server URL: https://booking.example.com
   API key: ••••••••••••••••••••••••••••••••••
   Saved profile "default" for https://booking.example.com.
   ```

   **The key is never accepted as a command-line argument** (for the same reason [`scripts/demo_data.py`](https://github.com/karanshukla/openresto/blob/main/scripts/demo_data.py) refuses passwords on `argv`): arguments are visible to other local processes via `ps`. `auth login` either prompts with hidden input or reads the key from stdin when piped:

   ```bash
   printf '%s' "$OPENRESTO_KEY" | openresto auth login --url https://booking.example.com
   ```

3. Verify the connection:

   ```bash
   openresto auth whoami
   ```

`auth login` and `auth whoami` also compare the server's `major.minor` version against the CLI version (patch differences are ignored). On a mismatch, the CLI prints a one-line `warning:` to stderr (for example: `warning: server is 1.8.0, CLI is 1.9.0 — commands may not match the server's API`). Because warnings are advisory and written to stderr, they never fail the command or corrupt `--json` output. Older servers without `/api/version` print a "server version is unknown" warning instead.

## Profiles

Multiple servers and keys can be stored as named profiles in `~/.config/openresto/config.json` (written with mode `0600`):

```bash
openresto --profile staging auth login
openresto --profile staging bookings list
```

Environment variables override stored profile fields individually, which is useful in CI or for one-off commands:

| Variable            | Overrides                                  |
| ------------------- | ------------------------------------------ |
| `OPENRESTO_URL`     | The profile's server URL                   |
| `OPENRESTO_API_KEY` | The profile's API key                      |
| `OPENRESTO_PROFILE` | Active profile name (same as `--profile`)  |

```bash
OPENRESTO_URL=https://booking.example.com OPENRESTO_API_KEY="$CI_OPENRESTO_KEY" \
  openresto bookings list --json
```

`openresto auth logout` removes the saved key for the active profile while keeping the server URL, so the next `auth login` only asks for a new key.

## Output

Every command prints a human-readable table by default. Pass `--json` (before or after the subcommand) for machine-readable output:

```bash
openresto bookings list --json | jq '.[] | select(.seats > 6)'
```

## Command groups

Run `openresto <group> --help` or `openresto <group> <command> --help` for full flag lists.

### `status`

Shows the admin overview: booking totals, today's covers, paused locations, and schedule-conflict count. (Unlike `auth whoami`, which inspects the API key itself, `status` reports server state.)

```bash
openresto status
```

### `auth`

Subcommands: `login`, `whoami`, `logout`.

```bash
openresto auth whoami
```

### `bookings`

Subcommands: `list`, `get`, `create`, `update`, `extend`, `email`, `cancel`, `restore`, `purge`.

```bash
openresto bookings list --location 1 --status upcoming
openresto bookings extend 42 --minutes 30
```

- **`purge`** permanently deletes a booking (the GDPR purge path) and prompts for confirmation. Pass `--yes` to skip the prompt (required when stdin is not a terminal, such as in scripts or CI).
- **`email`** sends a one-off message to the guest on a booking. Because the body can be multi-line, pass it via `--body-file` or stdin:

  ```bash
  openresto bookings email 42 --subject "Your table tonight" --body-file note.html
  printf 'Running 20 minutes late — see you soon.' | openresto bookings email 42 --subject "Update"
  ```

  If SMTP is not configured on the server, this fails with the error code `email.not_configured` so scripts can distinguish a setup issue from a transient transport error. You can check SMTP status without sending mail using `openresto email status`.

### `availability`

Subcommands: `check`. This calls a public endpoint (no key required, though the CLI sends one if configured).

```bash
openresto availability check --location 1 --date 2026-09-01 --seats 4
```

### `locations`

Subcommands: `list` (includes archived locations), `get`, `create`, `update` (online booking limits), `pause`, `unpause`, `extend`, `conflicts`, `dates list|add|remove`, `archive`, `restore`, `delete`.

```bash
openresto locations pause 1 --minutes 60
openresto locations pause 1 --rest-of-today    # until today's service ends
openresto locations extend 1 --minutes 30      # extend every active booking
openresto locations update 1 --max-party 8     # also --max-days-ahead, --min-notice, --min-party
openresto locations dates add 1 --date 2026-12-25 --type closed
openresto locations dates add 1 --date 2026-12-31 --type special-hours --open 18:00 --close 01:00 --last-booking 23:00
```

- **`update`** modifies only the four online booking limits (`none` clears a limit).
- **`dates`** manages exceptions to the weekly schedule (`closed`, `special-hours`, `walk-in-only`; running `add` on an existing date replaces it). Both `update` and `dates` read the location first and submit the updated record so all other settings remain intact.
- **`conflicts`** lists existing bookings that no longer fit after a schedule change (narrowed hours, dropped open days, or closed dates). Schedule edits do not alter existing bookings, so use this command to find affected guests.
- **`delete`** requires the location to be archived first (enforced server-side by `RestaurantManagementService`; the CLI prompts you to run `locations archive` first) and displays a delete preview with section, table, and booking counts before asking for confirmation.

### `tables`

Subcommands: `list` (lists a location's sections and tables together, because table writes require a section ID), `create`, `update`, `delete`. Find a section's ID with `tables list --location <id>` or `sections list --location <id>`, then pass it via `--section`.

```bash
openresto tables list --location 1
openresto tables create --location 1 --section 2 --name "T5" --seats 4
```

### `sections`

Subcommands: `list`, `create`, `update` (rename), `delete`. Section reordering is only available in the admin UI.

```bash
openresto sections create --location 1 --name "Patio"
openresto sections delete 2 --location 1
```

`delete` also removes the section's tables. Upcoming bookings referencing the section or its tables are kept with their table/section foreign keys set to null rather than cascade-deleted (see `CLAUDE.md`, "Deletion & cascade behaviour"). The CLI previews the number of affected bookings before confirming.

### `brand`

Subcommands: `get`, `set`. Pass flags or `--from-json <file>` (`--from-json -` for stdin). Matching `PATCH /api/brand`, an empty string clears a field and an omitted field leaves it unchanged.

```bash
openresto brand set --app-name "My Restaurant" --primary-color "#0a7ea4"
```

### `users`

Subcommands: `list` (`users:read`), `activate`, `deactivate` (`users:write`). Owner-only on the server; a key without the required `users` scope or belonging to a non-Owner account receives `403`.

```bash
openresto users list
openresto users deactivate 3
```

Creating accounts, changing roles, and setting passwords are intentionally unavailable via API keys. Allowing a key to create or take over an interactive admin login would let it escalate beyond its own scopes. Perform those actions in the admin UI while signed in as an Owner.

### `audit`

Subcommands: `list` (Owner-only). Supports the same filters as the admin activity trail: `actorUserId`, `action` prefix, `targetType`, `location`, `from`/`to`, and `page`/`pageSize`.

```bash
openresto audit list --action booking --from 2026-08-01
```

### `email`

Subcommands: `status`, `failures`. Read-only; SMTP credentials cannot be viewed or changed with an API key.

```bash
openresto email status
openresto email failures
```

Booking confirmations are best-effort on the server: if sending fails, the failure is recorded and the booking still succeeds. `status` distinguishes between unconfigured SMTP (`isConfigured: false`) and disabled confirmations (`sendBookingConfirmations: false`). `failures` redacts recipient addresses when the key lacks `guests:read`, matching the booking endpoints.

## Scopes

Every admin endpoint is gated by a `{resource}:{access}` scope on the API key:

| Resource    | Available access | Notes                                                                 |
| ----------- | ---------------- | --------------------------------------------------------------------- |
| `bookings`  | `read`, `write`  | `write` also satisfies `read`                                         |
| `locations` | `read`, `write`  | `write` also satisfies `read`                                         |
| `tables`    | `read`, `write`  | `write` also satisfies `read`                                         |
| `brand`     | `read`, `write`  | `write` also satisfies `read`                                         |
| `users`     | `read`, `write`  | Owner-only; `write` covers activate/deactivate only                   |
| `audit`     | `read` only      | Owner-only; no `write` level exists                                   |
| `guests`    | `read` only      | Controls visibility of guest names and emails; no `write` level exists |
| `email`     | `read` only      | Status and delivery failures only; SMTP settings cannot be modified by API key to prevent mail interception |

Create keys with the narrowest scopes required (for example, give a reporting script `bookings:read` only). A `403` response names the exact missing scope (`This API key is missing the 'bookings:write' scope.`), making it straightforward to adjust permissions deliberately. Run `openresto auth whoami` to inspect a key's scopes.

## Development

Run these commands inside a clone of the [OpenResto repository](https://github.com/karanshukla/openresto), not against the published npm package:

```bash
npm run typecheck   # tsc --noEmit
npm test            # builds, then runs the node:test suite in dist/
npm run build       # compile TypeScript to dist/
```

### Regenerating the transport types

`src/generated/api.d.ts` is generated from the backend's OpenAPI document (`openresto-cli/openapi/v1.json`) with [`openapi-typescript`](https://openapi-ts.dev/). It provides request and response types for the hand-written fetch transport (`src/transport.ts`). Generated operation names do not dictate the CLI's command layout; the command tree is designed by hand and mapped to the underlying endpoints.

Both files are committed, and CI's `OpenAPI Drift` job ([`.github/workflows/ci.yml`](https://github.com/karanshukla/openresto/blob/main/.github/workflows/ci.yml)) fails if either is out of date. To regenerate them after an API change:

```bash
# from the repo root
dotnet build
(cd tools/OpenApiExport && dotnet run --no-build -- ../../openresto-cli/openapi/v1.json)
(cd openresto-cli && npm run generate:types)
```

See [`tools/OpenApiExport/Program.cs`](https://github.com/karanshukla/openresto/blob/main/tools/OpenApiExport/Program.cs) for why the OpenAPI document is emitted by booting the API in-process with `WebApplicationFactory` rather than through MSBuild build-time generation.
