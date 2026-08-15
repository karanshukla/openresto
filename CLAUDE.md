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
npm run check        # prettier + oxlint (what CI runs)
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

### Running E2E tests (Playwright) — read before running

The full-stack rate limiters are gated on `ASPNETCORE_ENVIRONMENT` (see `OpenRestoApi/Extensions/ServiceCollectionExtensions.cs`): **Development** (plain `docker compose up`) allows auth 10/min, public 120/min, global 300/min, which is fine for clicking around and far too tight for the suite; **Testing** (the `docker-compose.e2e.yml` override) raises all three to 10000/min. **Always start the stack with the e2e override:**

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build
npm run test:e2e --prefix openresto-frontend
```

Running against Development produces cascading 429s: pages that hydrate from rate-limited fetches (booking form, /locations, /settings) fail to render in time, booking POSTs exhaust their retries, and customer lookup returns null (rendered as a false "No booking found"). It looks like selector bugs and is purely rate-limit exhaustion.

To verify the environment, **repeat both `-f` flags on the exec**:

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml exec backend printenv ASPNETCORE_ENVIRONMENT
```

The bare `docker compose exec backend printenv ASPNETCORE_ENVIRONMENT` is not trustworthy here. Under podman-compose (the `docker` CLI on a Fedora host is usually a podman shim) `exec` re-injects the service environment as parsed from the compose files passed to _that_ invocation, so omitting the override re-applies `ASPNETCORE_ENVIRONMENT=Development` from `docker-compose.yml` to the exec session and shadows the container's real value. It reports `Development` for a container genuinely running `Testing` — which reads as "the override silently failed" and sends you rebuilding a stack that was already correct. `docker inspect <container> --format '{{range .Config.Env}}{{println .}}{{end}}'` always shows the truth. Plain Docker Compose doesn't rewrite env on exec, so the bare form is only misleading on podman.

The config uses `workers: 1` and a `globalSetup` that logs in once to `e2e/.auth/admin.json`; specs still use `postWithRetry`/`getWithRetry` and `expectVisibleWithReload` for the rare in-Testing collision.

**Smoke vs. extensive split**: a handful of `test.describe` blocks covering
the golden paths (home browse, the full booking journey, booking
confirmation, customer lookup, admin login/logout, admin dashboard) are
tagged `{ tag: "@smoke" }`. `npm run test:e2e:smoke` (`--grep @smoke`) runs
just that subset; `npm run test:e2e:extensive` (`--grep-invert @smoke`) runs
everything else; `npm run test:e2e` still runs the full suite for local
debugging. In CI (`.github/workflows/ci.yml`), `e2e-smoke` runs on every PR
and push; `e2e-extensive` is gated to `push` on `main` only, so PRs get fast
feedback on the golden paths and the full-depth run happens once per merge.
When adding a new spec, tag its `describe` block `@smoke` only if it covers
a path a broken deploy can't ship without — most new coverage belongs in the
extensive set by default (i.e., untagged).

### Release (tag-triggered)

```bash
# 1. Add a ## [x.y.z] - YYYY-MM-DD section to CHANGELOG.md
# 2. Bump "version" in package.json (root) and openresto-frontend/package.json
#    to the tag without the v prefix, then regenerate both lockfiles:
npm install --package-lock-only && npm install --package-lock-only --prefix openresto-frontend
# 3. Confirm everything agrees before tagging (CI runs this too):
./scripts/check-release-version.sh v1.0.0
git tag v1.0.0
git push origin v1.0.0
```

Never hand-edit the lockfiles; `--package-lock-only` is what keeps their top-level `version` in sync.

**Pick the number by semver, not by habit.** A release containing any new feature is a minor bump, even a small one. Patch is for fixes only.

`scripts/check-release-version.sh` is the guard against a half-finished bump: it asserts the two `package.json`s, the two `package-lock.json`s, and a CHANGELOG section all agree with the tag. The `verify-version` job in `release.yml` gates all three image builds on it, so a mismatch fails the release before anything reaches GHCR. v1.6.0 shipped with all four version fields still reading `1.5.0`, which is what this exists to prevent.

The frontend's Expo config takes its `version` from `openresto-frontend/package.json` (`app.config.ts` imports it), so there is nothing to bump there. `app.json` deliberately carries no `version` key: `app.config.ts` overrides everything it sets, so a value there is silently dead.

This triggers `.github/workflows/release.yml`, which builds `linux/amd64` + `linux/arm64` images for backend, frontend, and nginx; pushes them to GHCR (`ghcr.io/karanshukla/openresto-{backend,frontend,nginx}:<tag>`); and creates a GitHub Release with the per-version CHANGELOG section as notes and a pinned `docker-compose.yml` as a downloadable asset.

`docker-compose.release.yml` in the repo is the self-hoster install template. It references `${OPENRESTO_VERSION:-latest}` — the release workflow substitutes the actual tag before attaching it to the release. Self-hosters can also run any version directly:

```bash
OPENRESTO_VERSION=1.0.0 docker compose -f docker-compose.release.yml up -d
```

## Code comments

Don't add comments above functions or inline unless the WHY is genuinely non-obvious (a hidden constraint, a subtle invariant, a workaround for a specific bug). Well-named identifiers should make the WHAT self-evident. Before reaching for a comment, check whether the explanation can instead be expressed through abstraction or encapsulation — e.g. business logic embedded in a controller should move to a self-commenting, domain-named method in `Core/Application/Services` rather than being explained in a comment. Favor human-readable, domain-driven names and logical flow over prose explanations, while keeping code legible to agents working in this repo.

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
- **Contact info lives at two levels**: `Restaurant.PhoneNumber`/`EmailAddress` (per-location) override `BrandSettings.PhoneNumber`/`EmailAddress` (global default), resolved **per field** so a location that lists only a phone still inherits the global email. Both sides normalize through `ContactFields` (blank clears, trim, caps from `ContactLimits`); the frontend mirrors the resolution in `utils/contact.ts`. `SocialLink` is deliberately global-only and stays the footer + last-resort contact mechanism.
- **Combinable table groups**: `TableGroup` + `TableGroupMembership` model tables an admin has flagged as pushable-together; a group is a bookable unit alongside individual tables, and `Booking` stays 1:1 with what it reserves (`TableId` XOR `TableGroupId`). Three invariants are easy to break: (1) a member table is **still individually bookable** — grouping only deprioritizes it, so `TableAutoAssigner`/`AvailabilityService` order ungrouped → grouped → group within each capacity rather than hiding members; (2) mutual exclusion between a member's booking and its group's booking is enforced by `IBookingRepository.IsUnitBookedOnDateAsync` and `IHoldService.IsTableHeld` (a group booking stores `TableId = null`, so any table-only conflict check will miss it); (3) `CombinedSeats` must stay in `(largest member seats, sum of member seats]`, and because the memberships→tables FK is `ON DELETE CASCADE`, anything that deletes or resizes a member table must call `RestaurantManagementService.ReconcileTableGroupsAsync` or the group will advertise capacity it can't seat.
- `HoldService` is a **singleton** in-memory store — appropriate for single-instance deployment. Holds expire after 5 minutes. If you need multi-instance, swap for Redis.
- The OpenAPI spec (`/openapi/v1.json`) is only exposed when `ASPNETCORE_ENVIRONMENT=Development`. The dev nginx template (`nginx/default.conf.template`) proxies `/openapi/` to the backend for ZAP CI scanning; the prod nginx (`nginx-vps/`) does not.
- **EF migrations with running dev server**: exe is locked, so use `dotnet ef migrations add <Name> --no-build`. If obj/ DLLs are stale the generated `Up()` will be empty — write it manually.
- **`dotnet ef migrations add` Roslyn version pin**: `Microsoft.EntityFrameworkCore.Design`'s own dependency on `Microsoft.CodeAnalysis.CSharp.Workspaces`/`Microsoft.CodeAnalysis.Workspaces.MSBuild` resolves to an older version than `Microsoft.CodeAnalysis.CSharp`/`.Common` get bumped to elsewhere in the graph (via `csulpizi.CustomAccessibility`'s own floor requirement) — a split-version Roslyn install that crashes migration scaffolding at design-time with `TypeLoadException: ReduceExtensionMember ... does not have an implementation` (build/test/runtime never hit this path, so it stays silent otherwise). `OpenRestoApi.csproj` pins `Microsoft.CodeAnalysis.CSharp.Workspaces`/`Workspaces.MSBuild` to match the higher-resolved version to unify the chain; these are `PrivateAssets="all"` and confirmed (via `dotnet publish` diff) not to ship in the runtime output. If `dotnet ef migrations add` starts crashing again after an EF Core upgrade, re-check these pins against whatever `Microsoft.CodeAnalysis.CSharp`/`.Common` actually resolve to (`dotnet restore` + inspect `obj/project.assets.json`) and bump them to match.
- **SCRIPTS** - `scripts/` contains dev/ops scripts (seeding, demo reset, admin recovery). They are not part of the production image. Make sure you update them if the DB is changing in a way that would break them (e.g. new required fields).
- **`scripts/demo_data.py` is the single source of truth for seed/demo data.** It declares the dataset and emits SQL (`config` / `bookings` / `media` / `accounts` / `all`); `seed-local.sh` and `purge-bookings.sh` (the demo VPS's 2-hourly reset) are thin wrappers. Add new data here, never inline in a shell script, and when adding a column add it to the dataset too or the demo silently stops exercising it. The dataset deliberately covers every feature flag the product has (per-day hours incl. a past-midnight wrap, both booking-ref formats, all contact-fallback states, 15/30/60 slot intervals, walk-in-only global and per-day, a live booking pause, an archived location, the table-oversize cap, named/unnamed combinable groups), each location annotated with the feature it surfaces. `accounts` covers an Owner (no display name) and a Manager (one), so both roles and both display-name branches are clickable. It is **not** part of `all`: it needs an admin password from `ADMIN_EMAIL`/`ADMIN_PASSWORD` or `--settings-file` (never argv, where `ps` would expose it), and it wipes the table first so a visitor-invited account doesn't survive the reset. Each section emits its own `BEGIN`/`COMMIT`, so apply `accounts` as a separate batch. Bookings are generated against the rules the server enforces (opening hours, capacity, oversize cap, the table/group mutual exclusion in `IsUnitBookedOnDateAsync`), so seeded rows never conflict and always carry an `EndTime`.
- **Demo artwork is derived from disk, never hardcoded.** `MediaService` writes uploads into deterministic slots (`hero.<ext>`, `location-<id>.<ext>`, `menu-<id>.pdf`), so `demo_data.py config` leaves `ImageUrl`/`HeaderImageUrl` NULL and the `media` section (`--media-dir DIR`) emits UPDATEs for the files that actually exist. That is why an uploaded image survives a reseed, and why a hardcoded path can never point at a missing file. The media step only ever sets a URL, never nulls one, so it composes on top of `config`; a served `menu-<id>.pdf` wins over an external `menu_url` in the dataset. On the VPS, `data/media-snapshot/` is the curated source of truth — drop correctly-named files in there (or upload via the admin UI and re-snapshot) and they appear on the next reset. Anything not in the snapshot is wiped every run on purpose: demo admin credentials are public, so visitor uploads must not persist.
- **Migrations run against data, not an empty schema.** SQLite accepts `ALTER TABLE ADD COLUMN` with a non-constant default (`CURRENT_TIMESTAMP`, `CURRENT_DATE`, any parenthesised expression) only while the table is empty; with a single row present it fails with `Cannot add a column with non-constant default`. A fresh install's tables are empty at migration time and every real install's are not, so this shape passes locally, passes CI, and then breaks every upgrade. `AddMultiUserAccounts` shipped it and broke the VPS deploy. To add a column with a non-constant default: add it **nullable**, backfill with `migrationBuilder.Sql`, then rebuild the table (SQLite has no `ALTER COLUMN`) so both paths land on the same definition — see that migration for the pattern. `migration-check.yml` now seeds a row into every table (`scripts/fill-schema-fixture.py`) before applying the new migrations, so this class fails in CI instead of in production.
- **Migration safety invariant**: a new migration's `Up()` must produce an identical schema whether applied to a fresh database or an upgrade from the previous migration. The `migration-check.yml` CI workflow enforces this by generating SQL for both paths, applying them to SQLite, and diffing the schemas. If they diverge (e.g. `EnsureCreated` and `Migrate()` produce different column order or constraints), the check fails. Always verify that `dotnet ef migrations script "0" PREV_MIGRATION` + `dotnet ef migrations script PREV_MIGRATION` together match `dotnet ef migrations script`.
- **Auto-migration on startup**: `DatabaseExtensions.InitializeDatabase` calls `db.Database.Migrate()` with a retry loop before `app.Run()`. Fresh installs and upgrades are both handled automatically — no manual SQL steps needed.
- **Cross-platform image generation**: use `Magick.NET-Q8-AnyCPU` (ships Linux x64 native libs, no apt-get needed). Never add `Svg` (SVG.NET) — it uses `System.Drawing.Common` which is Windows-only in .NET 7+.

### Frontend — Expo Router file-based routing

```
openresto-frontend/
├── app/
│   ├── (user)/           # Customer-facing: index (search), book, lookup
│   └── admin/            # Dashboard, bookings, locations, notifications, settings/*
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
- **Component styles live in a sibling `<Component>.styles.ts` exporting `styles`** — but **never inside `app/`**. Expo Router treats every module under `app/` as a route, so `app/admin/dashboard.styles.ts` becomes the route `/admin/dashboard.styles`, and — far worse — `app/admin/_layout.styles.ts` matches the `_layout` convention and is loaded as a _layout_, re-parenting every sibling route under `/admin/_layout.styles/...` so `/admin/dashboard` stops existing. Nothing catches this: `tsc`, Jest and lint all pass, and only an E2E run against real routing fails. Screen-level styles therefore live in `styles/` (mirroring the route tree: `styles/admin/dashboard.styles.ts`, `styles/user/lookup.styles.ts`); only styles for components under `components/` sit next to their component. The **Route Manifest** CI job (`npm run routes:check`) guards this: it exports the web build, derives the route list from the emitted HTML, and diffs it against `openresto-frontend/routes.snapshot.txt`. Intentional route changes need `npm run routes:update` and the snapshot committed — routes are public URLs, so changing one should be deliberate.
- **Admin settings is a route group, not a page**: `app/admin/settings/` holds one route per concern (`brand`, `email`, `users`, `account`) and an `index` that redirects to `brand`, so `/admin/settings` keeps working for old links. Each route is a thin list of cards inside `SettingsPage` (shared scroll container, title, and the 880px form column); the cards themselves are unchanged and still take the `borderColor`/`mutedColor`/`cardBg` palette from `useSettingsPalette`. `SettingsPage` also takes an optional `aside`, which renders in a sticky right-hand column above `SPLIT_MIN_WIDTH` (1100px) and stacks above the cards below it.
- **The brand route previews the home page live.** `/admin/settings/brand` is five cards (Brand Identity, Homepage Header, Contact & Website, Highlights, Footer) beside a `BrandPreview` aside. Each card owns its own subset of the brand record, which works because `PATCH /api/brand` reads null as "unchanged" and `""` as "clear" — a card must send `""`, never `undefined`, to clear a field it owns (the favicon deselect was broken for exactly this). The preview reads `BrandDraftContext`, not `BrandContext`: cards publish unsaved values via `useBrandDraftPublish`, so a field that only reaches `saveBrandSettings` won't appear until a reload. `BrandPreview` is a static miniature of `app/(user)/index.tsx` with its own copy of the default strings, so keep the two in step. `users.tsx` waits for `status !== "loading"` before gating on `can()`: an unresolved session has no role, so it would bounce an Owner on a cold load.
- **Editing an existing record autosaves; the admin's settings and locations forms have no Save button.** `useAutosave` (`hooks/use-autosave.ts`) takes `values` (the payload as it would be sent), `saved` (same shape, from the server-backed context) and `save`; `SaveStatus` renders the outcome where the button was. Both are compared serialised, so fresh object literals per render are fine. Four things bite: (1) the context doesn't refetch after a write, so the hook treats its last committed payload as the baseline — reading dirtiness from `saved` alone re-sends forever; (2) `canSave` withholds writes the server would reject mid-keystroke, and every rule it encodes must mirror a real backend one; (3) a pending debounce flushes on unmount, so `save` must close over the right record id; (4) with no button to grey out, a silent withheld write reads as a broken autosave — state the reason instead (`RestaurantInfoForm` derives a `blockedReason` and renders it where `SaveStatus` sits). `saveBrandSettings` returns `AdminMutationResult`, so success is `result.ok`, never a substring check on the message. Undo works on committed state, not uncommitted edits, which is why it replaced Discard: pass `onRestore` and the hook offers a single-level `undo` for `undoWindow` (10s) after a write lands, putting the old payload back into both the form and the server. Supplying `onRestore` is what enables it — without a way to move the inputs back, undoing would write the old values while the form kept showing the new ones and the next keystroke would re-save them. `undo` commits its target as the baseline before restoring, so the restored values aren't detected as a fresh edit and written twice.
- **Buttons are one primitive, two layouts.** Every button in the app is `components/common/Button` — there is no second way to draw one, and a `Pressable` styled to look like a button is a bug. Its two axes are independent: `variant` is weight (`primary` filled / `secondary` outlined / `ghost` bare) and `tone` is meaning (`brand` / `danger` / `warning` / `success` / `neutral`), so "Remove image" and "Yes, delete permanently" are the same destructive control at two weights rather than two hand-rolled styles. `variant="danger"` is a kept alias for filled-destructive. Sizes: the admin uses `size="md"` (44px, the WCAG 2.5.5 target) for every action; `lg` is for a focused form's own submit (login, the booking form); `sm` is the row scale. Buttons group through `components/common/ButtonRow`, whose children keep their natural width — it wraps rather than using a breakpoint, so a cluster too wide for its card drops to a second line instead of one button stretching full-width while its neighbour shrinks. Source order is reading order: **dismissing and destructive actions first, the primary last**, and a cluster gets **one** filled button. `fullWidth` is opt-in and reserved for a form's single submit. **Row-level actions** (a list row's trailing cluster) are `components/common/RowTextButton` — a named pill, never a bare glyph, because the admin runs on tablets for staff who are not in it daily; it reaches 44px through hitSlop so rows stay dense. Icon-only controls (`IconButton`) are for the handful of universally-read glyphs in genuinely constrained chrome — a modal close, a reorder arrow, a date-bar chevron — and always carry an `accessibilityLabel`.
- **A filled button means create or commit, never "save".** Autosave took "save" away from field edits, leaving the filled button one honest meaning: it makes something new, or does something you can't walk back. A list's standing create CTA is `AddRow` (collapsed to one `Add X`, expanded to fields plus Cancel/Add) in `<ButtonRow align="start">`, flush with the rows it appends to. A form serving both new and existing rows (`SocialLinkEditForm`, `HighlightsCard`'s editor) takes `isNew` and labels the commit **Add** or **Save** to match; a create labelled "Save" is the bug this rule catches. Deliberate explicit-press carve-outs: `SecurityCard` (the press is the confirmation for a credential change), `EmailSettingsCard` (`sendBookingConfirmations` ships with the SMTP credentials and `handleTest` saves before testing, so a debounce would put half-typed credentials on the wire and test against them), `BookingDetailPopup` and `DangerZone` (guest-visible or irreversible), and `TableRow` (its Cancel genuinely reverts).
- **Chrome favicon caching**: never update `<link rel="icon">` href in-place — Chrome ignores it. Remove all existing favicon links then append a fresh `<link>` element to force re-read.
- **PWA manifest URL**: must remain a same-origin HTTP(S) URL. Replacing `<link rel="manifest">` href with a `blob:` URL silently breaks Chrome's PWA installability check.
- **SW cache versioning**: bump `CACHE_NAME` in `public/sw.js` on every deploy that changes `public/manifest.json`, otherwise browsers serve the stale cached manifest.
- Tab favicon (SVG data URI via `injectBrandFavicon`) works in standalone dev. PWA install icon requires Docker — nginx must proxy `/api/brand/pwa-icon-*.png` to the backend.
- `app/+html.tsx` is Expo Router's HTML `<head>` template for static output mode — favicon link, manifest link, and SW registration script all live here.
- **Cross-platform scroll-to-element**: to smoothly scroll a `ScrollView` to a specific child after it appears, use two paths: on web call `(ref.current as unknown as HTMLElement).scrollIntoView?.({ behavior: "smooth", block: "start" })`; on native call `findNodeHandle(scrollRef.current)` then `childRef.current.measureLayout(node, (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }), () => {})`. Wrap in a `setTimeout` of ~150 ms so layout settles before measuring. See `app/(user)/lookup.tsx`.
- **Lint `no-explicit-any`** (oxlint, `.oxlintrc.json`, replaces ESLint): never cast with `as any`. When you need to access a DOM method unavailable on the RN type, use `as unknown as HTMLElement` (or the appropriate DOM type) instead. React Compiler-only `react-hooks/*` rules (e.g. `set-state-in-effect`) have no oxlint equivalent yet and are no longer enforced.

### Auth model

**Admin users** — `AdminCredential` holds one row per user (PBKDF2 hash, per-user PVQ, `Role`, `IsActive`); the table name predates multi-user support and stays put so the migration is additive. `POST /api/admin/auth/login` looks the account up by email and mints a JWT carrying `sub` (user id), email, and the account's own role.

- **Roles live in one allow-list** (`Core/Application/Utilities/UserRoles.cs`): `Owner` and `Manager`, plus `Admin` — the claim value minted before multi-user existed, honoured only so 30-day tokens issued by an older build keep working. No user row ever carries it.
- **Gating goes through named policies** (`AuthPolicies` + `AddAuthorization` in `ServiceCollectionExtensions`), never raw role strings on controllers. `RequireAdmin` = any admin; `RequireOwner` = user management. Adding a role, or swapping roles for permission claims, is a change to those two places.
- **The user id is the identity.** `ICurrentUserService` reads it off the claims and `CurrentUserResolver` turns it into the row; email is only a fallback for id-less legacy tokens. Self-service (change password/email, PVQ setup) always targets that row — never "the" credential.
- **The first-run bootstrap lives only in `AdminBootstrap`** (called from `InitializeDatabase`) and creates an Owner. Login does not create accounts; an unknown email is just a failed login.
- **Lockout protection** is a set of `UserService` business rules (`BusinessRuleException`), not authorization checks: the instance must always keep one active Owner, and you can neither deactivate your own account nor change your own role (both would revoke the access you are using). The self rules are checked first, so that is the message you get when both apply.
- Frontend: `context/AuthContext.tsx` resolves `/admin/auth/me` once per admin-layout mount and is the only place the signed-in identity lives; role gating goes through `useCan(capability)` with the capability matrix in `constants/roles.ts` (mirrors the backend). Never inline a `role === "Owner"` check.

**Customer bookings** — no auth. Customers identify via `BookingRef` (short random string) or the encrypted recent-bookings cookie.

### Brand / Favicon

- `BrandSettings.FaviconIcon` — nullable string (max 32 chars), validated server-side against `LucideIconPaths.cs` (15 icons: utensils, wine, coffee, pizza, flame, leaf, star, heart, chef-hat, fish, hamburger, sandwich, soup, cake, ice-cream-cone).
- `GET /api/brand/pwa-icon.svg` — SVG with brand-colored rounded-rect background + white Lucide icon; used for the browser tab favicon.
- `GET /api/brand/pwa-icon-{192|512}.png` — PNG generated via `Magick.NET-Q8-AnyCPU`; used as PWA manifest icons. Both return 404 when no icon is configured; Chrome falls back to static PNGs.
- Frontend: `utils/injectBrandFavicon.ts` runs from `BrandContext` after brand loads and posts `BRAND_UPDATE` to the SW to patch the manifest `name`/`theme_color`. Icon picker in `BrandSettingsCard`; SVG path data + `buildFaviconDataUri()` in `constants/faviconIcons.ts`.

### Deletion & cascade behaviour

**Table / Section deletion** — `Booking.TableId` and `Booking.SectionId` are **nullable** (`int?`). Deleting a table or section does **not** cascade-delete its bookings; instead, `DeleteTableAsync` and `DeleteSectionAsync` in `RestaurantManagementService` explicitly null those FK columns on affected bookings before removing the parent row. The DB FK is `ON DELETE SET NULL`. `ToDetailDto` in `AdminService` returns `"Table"` / `"Section"` as display fallbacks when the FK is null.

**Restaurant deletion** — a hard-delete endpoint (`DELETE /admin/restaurants/{id}` via `AdminService.DeleteRestaurantAsync`) already exists and cascades to all sections, tables, and bookings. There is currently **no UI** wired to it. The recommended UX pattern (see `docs/delete-restaurant-investigation.md`) is:

1. **Archive first** — add `IsArchived` flag to `Restaurant`, filter it from public/admin lists, expose `PATCH /admin/restaurants/{id}/archive`. Reversible, zero data loss.
2. **Permanent purge second** — only offer the hard-delete UI after a location is already archived, making an accidental wipe essentially impossible.

Booking history is intentionally **GDPR-purgeable** via the existing `PurgeBookingAsync`, so "losing history on restaurant deletion" is not a concern by design.

### Testing

- **Backend**: xUnit + Moq. Tests live in `OpenRestoApi.Tests/`. Services are tested in isolation with mocked repos and a mock `ISystemClock` (inject `MockSystemClock` to control time-dependent hold/availability logic).
- **Backend coverage numbers**: the reported figure (CI badge, Coveralls, PR comment) excludes EF migrations, matching a local `dotnet test /p:CollectCoverage=true` run — both read the same exclusion list, just from different places. `OpenRestoApi.Tests.csproj`'s `<Exclude>` governs the MSBuild integration (`coverlet.msbuild`, used for local runs); CI's `--collect:"XPlat Code Coverage"` reads exclusions from `coverlet.runsettings` (repo root, via `--settings`) instead, since the VSTest collector doesn't read the csproj property. Keep the two `<Exclude>` values in sync — see `coverlet.runsettings` for why.
- **Frontend**: Jest + React Native Testing Library. 100% coverage target. E2E with Playwright (`tests/e2e/`).
- **Testing async effects with delays**: for `useEffect` code that fires inside a `setTimeout`, use `waitFor` with a custom `timeout` (e.g. `{ timeout: 1000 }`) rather than fake timers — the real timer fires within the `waitFor` polling window. Example: `await waitFor(() => expect(mockFn).toHaveBeenCalled(), { timeout: 1000 })`.
- **Testing cross-platform scroll**: In the jsdom + RN test renderer environment, `View` refs are RN component instances (NOT DOM elements), so `HTMLElement.prototype.scrollIntoView` is never reachable. Test the web scroll path by waiting past the timeout delay and asserting no crash (the `scrollIntoView?.()` optional chain is a no-op but the line is still covered). For the native path, spy on `findNodeHandle` via `jest.spyOn(require("react-native"), "findNodeHandle")`.
- **CI ZAP scan**: runs against the full Docker stack; the OpenAPI spec (`/openapi/v1.json`) is used as the scan target so ZAP discovers all endpoints. Ignored rules are listed in `.zap-rules.tsv`.
- **Migration safety check** (`.github/workflows/migration-check.yml`): triggers on any PR/push that adds or modifies files in `OpenRestoApi/Migrations/` or `AppDbContext.cs`. Detects which migration files are new, generates baseline SQL (0 → last old migration), generates upgrade-only SQL (last old migration → HEAD), applies both paths to separate SQLite databases, and asserts their schemas match. Also generates an idempotent script as a sanity check. Does not trigger if no migration files changed.
- **Backup/restore**: see `docs/backup-restore.md` for procedures covering named volumes, bind mounts, WAL checkpointing, automated cron backups, online `.backup` snapshots, and the safe upgrade path.
