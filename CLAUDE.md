# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run everything (recommended for local dev)

```bash
npm run dev          # starts backend (dotnet watch) + frontend (expo) concurrently
```

### Backend only

```bash
cd OpenRestoApi
dotnet watch run     # hot reload on :8080

cd OpenRestoApi.Tests    # or: dotnet test openresto.sln from the repo root
dotnet test          # all backend tests — NOTE: `dotnet test` from OpenRestoApi/ runs zero tests, that project isn't the test project
dotnet test --filter "FullyQualifiedName~BookingServiceTests"  # single test class
```

### Frontend only

```bash
cd openresto-frontend
npm run web          # Expo web dev server on :8081
npm test             # Jest unit tests
npm test -- --testPathPattern=BookingForm  # single test file
npm test -- --coverage  # coverage report
npm run test:e2e     # Playwright E2E tests
npm run check        # prettier + eslint (what CI runs)
npm run lint:fix     # auto-fix lint issues
```

### Docker (full stack through nginx)

```bash
# Full stack on localhost:5062 (builds from source). Default profile runs the
# backend in ASPNETCORE_ENVIRONMENT=Development.
docker compose up

# E2E profile: layers docker-compose.e2e.yml on top, which sets
# ASPNETCORE_ENVIRONMENT=Testing. This is MANDATORY for Playwright runs —
# see "Running E2E tests" below.
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d
```

**Starting Docker Desktop on this machine (Windows):** if `docker info` fails
(daemon not running), launch Docker Desktop yourself rather than asking the
user to do it manually:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

The daemon takes a while to come up after launch. Poll until it's ready instead
of a fixed sleep:

```powershell
$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 5
}
```

Once `docker info` succeeds, bring the stack up with the appropriate profile
(see "Running E2E tests" below for why the e2e profile matters). Docker
Desktop only needs to be launched once per machine session — if it's already
running, `docker info` succeeds immediately and this whole step is a no-op.

### Running E2E tests (Playwright) — read before running

The full-stack rate limiters are gated on `ASPNETCORE_ENVIRONMENT` (see
`OpenRestoApi/Extensions/ServiceCollectionExtensions.cs`):

- **Development** (plain `docker compose up`): auth 10/min, public 120/min,
  global 300/min — fine for manual clicking, **far too tight for the suite**.
- **Testing** (`docker-compose.e2e.yml` override): all three raised to
  10000/min. This is what the suite is designed for.

**Always start the stack with the e2e override before `npm run test:e2e`:**

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build
npm run test:e2e --prefix openresto-frontend
```

Running against the Development profile produces cascading 429s: pages that
hydrate from rate-limited fetches (booking form, /locations, /settings) fail
to render within timeout, booking-creation POSTs exhaust their retries, and
the customer lookup endpoint returns null (rendered as a false "No booking
found"). The failures look like selector/locator bugs but are purely
rate-limit exhaustion — they pass reliably under the Testing profile
(the suite drops from ~2.5 min to under a minute). Verify with
`docker compose exec backend printenv ASPNETCORE_ENVIRONMENT` if anything
looks off.

The Playwright config uses `workers: 1` and `globalSetup` logs in once,
saving the auth cookie to `e2e/.auth/admin.json` so admin-project specs skip
the login form. Specs that hit rate-limited endpoints still use
`postWithRetry`/`getWithRetry` (helpers.ts) and `expectVisibleWithReload`
as belt-and-suspenders for the rare in-Testing-window collision.

### Release (tag-triggered)

```bash
# Update CHANGELOG.md with a ## [x.y.z] - YYYY-MM-DD section first, then:
git tag v1.0.0
git push origin v1.0.0
```

This triggers `.github/workflows/release.yml`, which builds `linux/amd64` + `linux/arm64` images for backend, frontend, and nginx; pushes them to GHCR (`ghcr.io/karanshukla/openresto-{backend,frontend,nginx}:<tag>`); and creates a GitHub Release with the per-version CHANGELOG section as notes and a pinned `docker-compose.yml` as a downloadable asset.

`docker-compose.release.yml` in the repo is the self-hoster install template. It references `${OPENRESTO_VERSION:-latest}` — the release workflow substitutes the actual tag before attaching it to the release. Self-hosters can also run any version directly:

```bash
OPENRESTO_VERSION=1.0.0 docker compose -f docker-compose.release.yml up -d
```

## Architecture

Three-container stack: **Nginx** (`:5062`) → routes `/api/*` to **ASP.NET Core** (`:8080`) and `/*` to **Expo/React Native** (`:8081`). A shared Docker volume (`media_data`) serves uploaded images at `/media/`.

### Backend — Clean-ish layered architecture

```
OpenRestoApi/
├── Controllers/          # Thin HTTP layer — validate auth, call services, return DTOs
├── Core/
│   ├── Domain/           # Plain C# entities (Restaurant, Booking, Table, Section, …)
│   ├── Application/
│   │   ├── Services/     # Business logic (BookingService, AvailabilityService, AdminService, …)
│   │   ├── Interfaces/   # Contracts for repos, email, clock, holds
│   │   ├── DTOs/         # Request/response shapes
│   │   └── Mappings/     # Mapperly source-gen mappers (no AutoMapper)
└── Infrastructure/
    ├── Persistence/      # EF Core + SQLite (AppDbContext, repositories)
    ├── Holds/            # In-memory table hold service (singleton ConcurrentDictionary)
    ├── Email/            # MailKit SMTP wrapper
    ├── Cookies/          # Encrypted HttpOnly cookie for recent bookings (DataProtection)
    └── Auth/             # JWT generation helpers
```

**Key conventions:**

- All `DateTime` values are stored and passed as **UTC**. EF Core value converters enforce this globally in `AppDbContext`. Restaurant-local times are converted using the restaurant's IANA `Timezone` field only at display/availability-calculation time.
- `OpenDays` is a comma-separated string of ISO 8601 day numbers (`1`=Monday … `7`=Sunday).
- **Per-day opening hours**: `Restaurant.OpenHoursJson` (nullable JSON keyed by ISO day, e.g. `{"6":{"open":"11:00","close":"23:00"}}`) overrides `OpenTime`/`CloseTime` per day; resolve with `OpeningHoursHelper.GetHoursForDay`. `OpenDays` stays the canonical open/closed toggle. When an update sends identical hours for all 7 days they collapse back to `OpenTime`/`CloseTime` and `OpenHoursJson` is cleared. The API exposes a resolved 7-entry `openHours` list on `RestaurantDto`; the frontend mirrors the fallback logic in `utils/openingHours.ts`.
- **Walk-in-only locations**: `Restaurant.WalkInOnly` (bool) disables the whole online booking flow; `Restaurant.WalkInDays` (comma-separated ISO days, same format as `OpenDays`) disables it per-day. Resolve with `WalkInHelper`; the frontend mirrors the logic in `utils/walkIn.ts`. Walk-in-only locations stay publicly listed — `POST /api/bookings` and `POST /api/holds` reject, `/api/availability` returns an empty slots list, and the UI shows a walk-in notice instead of the booking CTA. Admin-recorded bookings (`AdminService.CreateBookingAsync`) are intentionally exempt so staff can still log walk-ins.
- `HoldService` is a **singleton** in-memory store — appropriate for single-instance deployment. Holds expire after 5 minutes. If you need multi-instance, swap for Redis.
- The OpenAPI spec (`/openapi/v1.json`) is only exposed when `ASPNETCORE_ENVIRONMENT=Development`. The dev nginx template (`nginx/default.conf.template`) proxies `/openapi/` to the backend for ZAP CI scanning; the prod nginx (`nginx-vps/`) does not.
- **EF migrations with running dev server**: exe is locked, so use `dotnet ef migrations add <Name> --no-build`. If obj/ DLLs are stale the generated `Up()` will be empty — write it manually.
- **`dotnet ef migrations add` Roslyn version pin**: `Microsoft.EntityFrameworkCore.Design`'s own dependency on `Microsoft.CodeAnalysis.CSharp.Workspaces`/`Microsoft.CodeAnalysis.Workspaces.MSBuild` resolves to an older version than `Microsoft.CodeAnalysis.CSharp`/`.Common` get bumped to elsewhere in the graph (via `csulpizi.CustomAccessibility`'s own floor requirement) — a split-version Roslyn install that crashes migration scaffolding at design-time with `TypeLoadException: ReduceExtensionMember ... does not have an implementation` (build/test/runtime never hit this path, so it stays silent otherwise). `OpenRestoApi.csproj` pins `Microsoft.CodeAnalysis.CSharp.Workspaces`/`Workspaces.MSBuild` to match the higher-resolved version to unify the chain; these are `PrivateAssets="all"` and confirmed (via `dotnet publish` diff) not to ship in the runtime output. If `dotnet ef migrations add` starts crashing again after an EF Core upgrade, re-check these pins against whatever `Microsoft.CodeAnalysis.CSharp`/`.Common` actually resolve to (`dotnet restore` + inspect `obj/project.assets.json`) and bump them to match.
- **SCRIPTS** - `scripts/` contains dev scripts for generating test data, purging bookings, and running a local SMTP server. They are not part of the production image. Make sure you update them if the DB is changing in a way that would break them (e.g. new required fields).
- **Migration safety invariant**: a new migration's `Up()` must produce an identical schema whether applied to a fresh database or an upgrade from the previous migration. The `migration-check.yml` CI workflow enforces this by generating SQL for both paths, applying them to SQLite, and diffing the schemas. If they diverge (e.g. `EnsureCreated` and `Migrate()` produce different column order or constraints), the check fails. Always verify that `dotnet ef migrations script "0" PREV_MIGRATION` + `dotnet ef migrations script PREV_MIGRATION` together match `dotnet ef migrations script`.
- **Auto-migration on startup**: `DatabaseExtensions.InitializeDatabase` calls `db.Database.Migrate()` with a retry loop before `app.Run()`. Fresh installs and upgrades are both handled automatically — no manual SQL steps needed.
- **Cross-platform image generation**: use `Magick.NET-Q8-AnyCPU` (ships Linux x64 native libs, no apt-get needed). Never add `Svg` (SVG.NET) — it uses `System.Drawing.Common` which is Windows-only in .NET 7+.

### Frontend — Expo Router file-based routing

```
openresto-frontend/
├── app/
│   ├── (user)/           # Customer-facing: index (search), book, lookup
│   └── (admin)/          # Admin dashboard, bookings list, settings
├── api/                  # Typed fetch wrappers (one file per resource: restaurants, bookings, holds, …)
├── components/
│   ├── booking/          # BookingForm, PopularTimesPicker, HoldStatusBanner, useTableHold
│   ├── restaurant/       # RestaurantCard (home page tiles)
│   └── admin/            # Dashboard, tables, settings components
├── context/
│   ├── BrandContext      # Fetches /api/brand on mount; provides appName + primaryColor globally
│   └── ThemeContext
└── hooks/                # useColorScheme, etc.
```

**Key conventions:**

- `EXPO_PUBLIC_API_URL` drives all API calls. In Docker it is `/api` (relative, goes through nginx). In standalone dev it is `http://localhost:5062`. The `buildEndpoint` helper in `BrandContext` normalises both forms.
- Availability is fetched per `(restaurantId, date, seats)`. The API returns 30-minute slots with `{ time, isAvailable, availableTableIds, category }`. `PopularTimesPicker` shows only `isAvailable: true` slots; closed days return an empty slots array from the backend.
- Table holds flow: frontend calls `POST /api/holds` → backend validates open hours + pause state + conflict-checks → returns a `holdId` + expiry. The `holdId` must be included in the subsequent `POST /api/bookings` request.
- **Chrome favicon caching**: never update `<link rel="icon">` href in-place — Chrome ignores it. Remove all existing favicon links then append a fresh `<link>` element to force re-read.
- **PWA manifest URL**: must remain a same-origin HTTP(S) URL. Replacing `<link rel="manifest">` href with a `blob:` URL silently breaks Chrome's PWA installability check.
- **SW cache versioning**: bump `CACHE_NAME` in `public/sw.js` on every deploy that changes `public/manifest.json`, otherwise browsers serve the stale cached manifest.
- Tab favicon (SVG data URI via `injectBrandFavicon`) works in standalone dev. PWA install icon requires Docker — nginx must proxy `/api/brand/pwa-icon-*.png` to the backend.
- `app/+html.tsx` is Expo Router's HTML `<head>` template for static output mode — favicon link, manifest link, and SW registration script all live here.
- **Cross-platform scroll-to-element**: to smoothly scroll a `ScrollView` to a specific child after it appears, use two paths: on web call `(ref.current as unknown as HTMLElement).scrollIntoView?.({ behavior: "smooth", block: "start" })`; on native call `findNodeHandle(scrollRef.current)` then `childRef.current.measureLayout(node, (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }), () => {})`. Wrap in a `setTimeout` of ~150 ms so layout settles before measuring. See `app/(user)/lookup.tsx`.
- **ESLint `no-explicit-any`**: never cast with `as any`. When you need to access a DOM method unavailable on the RN type, use `as unknown as HTMLElement` (or the appropriate DOM type) instead.

### Auth model

Two roles via JWT:

- **Admin** — obtained by `POST /api/auth/login`. Stored in `AdminCredential` (one row per restaurant, bcrypt password hash). Required for all `/admin/*` endpoints.
- **Customer bookings** — no auth. Customers identify via `BookingRef` (short random string) or the encrypted recent-bookings cookie.

### Brand / Favicon

- `BrandSettings.FaviconIcon` — nullable string (max 32 chars), validated server-side against `LucideIconPaths.cs` (15 icons: utensils, wine, coffee, pizza, flame, leaf, star, heart, chef-hat, fish, hamburger, sandwich, soup, cake, ice-cream-cone).
- `GET /api/brand/pwa-icon.svg` — SVG with brand-colored rounded-rect background + white Lucide icon; used for the browser tab favicon.
- `GET /api/brand/pwa-icon-{192|512}.png` — PNG generated via `Magick.NET-Q8-AnyCPU`; used as PWA manifest icons. Both return 404 when no icon is configured; Chrome falls back to static PNGs.
- Frontend: `utils/injectBrandFavicon.ts` called from `BrandContext` after brand loads; posts `BRAND_UPDATE` to SW to patch manifest `name`/`theme_color`. Icon picker in `components/admin/settings/BrandSettingsCard.tsx`; SVG path data + `buildFaviconDataUri()` in `constants/faviconIcons.ts`.

### Deletion & cascade behaviour

**Table / Section deletion** — `Booking.TableId` and `Booking.SectionId` are **nullable** (`int?`). Deleting a table or section does **not** cascade-delete its bookings; instead, `DeleteTableAsync` and `DeleteSectionAsync` in `RestaurantManagementService` explicitly null those FK columns on affected bookings before removing the parent row. The DB FK is `ON DELETE SET NULL`. `ToDetailDto` in `AdminService` returns `"Table"` / `"Section"` as display fallbacks when the FK is null.

**Restaurant deletion** — a hard-delete endpoint (`DELETE /admin/restaurants/{id}` via `AdminService.DeleteRestaurantAsync`) already exists and cascades to all sections, tables, and bookings. There is currently **no UI** wired to it. The recommended UX pattern (see `docs/delete-restaurant-investigation.md`) is:

1. **Archive first** — add `IsArchived` flag to `Restaurant`, filter it from public/admin lists, expose `PATCH /admin/restaurants/{id}/archive`. Reversible, zero data loss.
2. **Permanent purge second** — only offer the hard-delete UI after a location is already archived, making an accidental wipe essentially impossible.

Booking history is intentionally **GDPR-purgeable** via the existing `PurgeBookingAsync`, so "losing history on restaurant deletion" is not a concern by design.

### Testing

- **Backend**: xUnit + Moq. Tests live in `OpenRestoApi.Tests/`. Services are tested in isolation with mocked repos and a mock `ISystemClock` (inject `MockSystemClock` to control time-dependent hold/availability logic).
- **Frontend**: Jest + React Native Testing Library. 100% coverage target. E2E with Playwright (`tests/e2e/`).
- **Testing async effects with delays**: for `useEffect` code that fires inside a `setTimeout`, use `waitFor` with a custom `timeout` (e.g. `{ timeout: 1000 }`) rather than fake timers — the real timer fires within the `waitFor` polling window. Example: `await waitFor(() => expect(mockFn).toHaveBeenCalled(), { timeout: 1000 })`.
- **Testing cross-platform scroll**: In the jsdom + RN test renderer environment, `View` refs are RN component instances (NOT DOM elements), so `HTMLElement.prototype.scrollIntoView` is never reachable. Test the web scroll path by waiting past the timeout delay and asserting no crash (the `scrollIntoView?.()` optional chain is a no-op but the line is still covered). For the native path, spy on `findNodeHandle` via `jest.spyOn(require("react-native"), "findNodeHandle")`.
- **CI ZAP scan**: runs against the full Docker stack; the OpenAPI spec (`/openapi/v1.json`) is used as the scan target so ZAP discovers all endpoints. Ignored rules are listed in `.zap-rules.tsv`.
- **Migration safety check** (`.github/workflows/migration-check.yml`): triggers on any PR/push that adds or modifies files in `OpenRestoApi/Migrations/` or `AppDbContext.cs`. Detects which migration files are new, generates baseline SQL (0 → last old migration), generates upgrade-only SQL (last old migration → HEAD), applies both paths to separate SQLite databases, and asserts their schemas match. Also generates an idempotent script as a sanity check. Does not trigger if no migration files changed.
- **Backup/restore**: see `docs/backup-restore.md` for procedures covering named volumes, bind mounts, WAL checkpointing, automated cron backups, online `.backup` snapshots, and the safe upgrade path.
