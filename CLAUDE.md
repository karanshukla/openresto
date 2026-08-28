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

A comment is the last resort, not the first. Work down this ladder and only write prose when all four rungs fail:

1. **Abstraction and encapsulation.** Business logic explained by a comment in a controller belongs in a domain-named method in `Core/Application/Services` instead. Arithmetic spelled out in a comment (`// 44px target minus 30px of rendered height`) belongs in named constants that compute it. The same coercion explained in two places belongs in one named helper (`ContactFields.Normalize`, `OpeningHoursHelper.GetHoursForDay`).
2. **Human-readable subfunctions.** A comment labelling a block (`// Step 2: resolve the local day`, `// --- Sections ---`) means the block wants to be a method, or the line below already says it. Name it and delete the label. Sentinel values get names too: `UnlimitedOversize` beats `null // = no cap`.
3. **Unit tests that pin the rule, on both sides of its boundary.** A comment stating a business rule is a rule nothing enforces. Replace it with a pair of tests, one inside the boundary and one outside, named after the rule. A cap of four spare seats becomes "offers a table four seats over the party size" and "rejects a table five seats over", not `// max 4 spare seats`. The pair is the point: a single happy-path test documents a case, whereas the pair documents the limit and fails the day someone moves it. A comment goes stale silently.
4. **Integration/E2E tests for rules that only exist across a boundary.** Same idea one level up. A rule that only shows up end to end (an archived location staying out of `RestaurantDto`, a hold surviving into `POST /api/bookings`, a settings round-trip clearing a field) gets a spec, not a paragraph above the code.
5. **Whatever 1–4 can't reach.** Hidden constraints, upstream bugs, production-incident history, protocol requirements, reachability arguments for coverage suppressions. These stay, but keep them tight: state the constraint, not its biography. "Consolidates the check previously duplicated across four services" is biography; the reader needs the invariant, not the changelog.

Tests augment the rule rather than merely restating it: the rule becomes executable, and the boundary that prose only asserted is now enforced. What is left over after the rule is pinned (a threat model, an incident, an upstream bug) is rung 5 and can stay, but it should be the residue, not the rule written twice.

### Point at the test that carries the rule

When rung 3 or 4 is what replaced a comment, leave a link to the test so the rule stays findable from the code it governs. Use the form each toolchain understands:

- **TypeScript**: a markdown link in JSDoc, path relative to the file. VS Code renders it clickable on hover:

  ```ts
  /**
   * @see [walkIn.test.ts](../__tests__/utils/walkIn.test.ts) — pins that a
   * per-day walk-in flag closes only that day.
   */
  ```

- **C#**: `<seealso>` naming the test method. `cref` can't reach `OpenRestoApi.Tests` (the reference points the other way), so the name goes in the tag body and the checker resolves it:

  ```csharp
  /// <seealso>RestaurantTests.IsPausedFor_BlocksSittingInsideWindow</seealso>
  /// <seealso>RestaurantTests.IsPausedFor_AllowsSittingAfterWindow</seealso>
  ```

Say which rule the test pins, not just that one exists. A bare `@see` is noise.

`npm run check:doc-links` (run in CI by the `doc-links` job in `ci.yml`) fails on a `@see [name](path)` whose file is missing and on a `<seealso>` naming a method that no test class declares. Without it a renamed test rots the link silently, which is the same staleness problem the comment had.

### What this does not license

`<summary>` on a public domain property whose meaning is a data format (`OpenDays` being comma-separated ISO day numbers, `OpenHoursJson`'s shape) stays — that is rung 5 constraint documentation, not narration. Coverage and analyzer suppressions keep their justification (`[ExcludeFromCodeCoverage]` reasons, `#pragma warning disable` rationale). What goes is the summary that restates the signature, the block label, and the changelog entry about which method the code used to live in.

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
- **Pausing bookings is scoped to the window, not to the book**: `Restaurant.BookingsPausedUntil` closes the sittings that _start_ inside it, so a pause is "stop seating new arrivals for the next X hours" rather than "stop taking bookings at all until X". `IsPaused()` answers "is a pause running" (badges, the admin overview count); `IsPausedFor(bookingUtc)` is the gate every booking path uses — `BookingService`, `HoldPolicyService`, and `AvailabilityService`, which evaluates it **per slot** rather than once per request. A pause check placed before the requested date is normalized to UTC is the bug this replaced. Rejection wording comes from `PauseHelper` so the booking and hold paths say the same thing.
- **Combinable table groups**: `TableGroup` + `TableGroupMembership` model tables an admin has flagged as pushable-together; a group is a bookable unit alongside individual tables, and `Booking` stays 1:1 with what it reserves (`TableId` XOR `TableGroupId`). Three invariants are easy to break: (1) a member table is **still individually bookable** — grouping only deprioritizes it, so `TableAutoAssigner`/`AvailabilityService` order ungrouped → grouped → group within each capacity rather than hiding members; (2) mutual exclusion between a member's booking and its group's booking is enforced by `IBookingRepository.IsUnitBookedOnDateAsync` and `IHoldService.IsTableHeld` (a group booking stores `TableId = null`, so any table-only conflict check will miss it); (3) `CombinedSeats` must stay in `(largest member seats, sum of member seats]`, and because the memberships→tables FK is `ON DELETE CASCADE`, anything that deletes or resizes a member table must call `RestaurantManagementService.ReconcileTableGroupsAsync` or the group will advertise capacity it can't seat.
- `HoldService` is a **singleton** in-memory store — appropriate for single-instance deployment. Holds expire after 5 minutes. If you need multi-instance, swap for Redis.
- The OpenAPI spec (`/openapi/v1.json`) is only exposed when `ASPNETCORE_ENVIRONMENT=Development`. The dev nginx template (`nginx/default.conf.template`) proxies `/openapi/` to the backend for ZAP CI scanning; the prod nginx (`nginx-vps/`) does not.
- **EF migrations with running dev server**: exe is locked, so use `dotnet ef migrations add <Name> --no-build`. If obj/ DLLs are stale the generated `Up()` will be empty — write it manually.
- **`dotnet ef migrations add` Roslyn version pin**: `Microsoft.EntityFrameworkCore.Design`'s own dependency on `Microsoft.CodeAnalysis.CSharp.Workspaces`/`Microsoft.CodeAnalysis.Workspaces.MSBuild` resolves to an older version than `Microsoft.CodeAnalysis.CSharp`/`.Common` get bumped to elsewhere in the graph (via `csulpizi.CustomAccessibility`'s own floor requirement) — a split-version Roslyn install that crashes migration scaffolding at design-time with `TypeLoadException: ReduceExtensionMember ... does not have an implementation` (build/test/runtime never hit this path, so it stays silent otherwise). `OpenRestoApi.csproj` pins `Microsoft.CodeAnalysis.CSharp.Workspaces`/`Workspaces.MSBuild` to match the higher-resolved version to unify the chain; these are `PrivateAssets="all"` and confirmed (via `dotnet publish` diff) not to ship in the runtime output. If `dotnet ef migrations add` starts crashing again after an EF Core upgrade, re-check these pins against whatever `Microsoft.CodeAnalysis.CSharp`/`.Common` actually resolve to (`dotnet restore` + inspect `obj/project.assets.json`) and bump them to match.
- **SCRIPTS** - `scripts/` contains dev/ops scripts (seeding, demo reset, admin recovery). They are not part of the production image. Make sure you update them if the DB is changing in a way that would break them (e.g. new required fields).
- **`scripts/demo_data.py` is the single source of truth for seed/demo data.** It declares the dataset and emits SQL (`config` / `bookings` / `media` / `accounts` / `all`); `seed-local.sh` and `purge-bookings.sh` (the demo VPS's 2-hourly reset) are thin wrappers. Add new data here, never inline in a shell script, and when adding a column add it to the dataset too or the demo silently stops exercising it. The dataset deliberately covers every feature flag the product has (per-day hours incl. a past-midnight wrap, both booking-ref formats, all contact-fallback states, 15/30/60 slot intervals, walk-in-only global and per-day, a live booking pause, an archived location, the table-oversize cap, named/unnamed combinable groups), each location annotated with the feature it surfaces. `accounts` covers an Owner (no display name) and a Manager (one), so both roles and both display-name branches are clickable. It is **not** part of `all`: it needs an admin password from `ADMIN_EMAIL`/`ADMIN_PASSWORD` or `--settings-file` (never argv, where `ps` would expose it), and it wipes the table first so a visitor-invited account doesn't survive the reset. Each section emits its own `BEGIN`/`COMMIT`, so apply `accounts` as a separate batch. Bookings are generated against the rules the server enforces (opening hours, capacity, oversize cap, the table/group mutual exclusion in `IsUnitBookedOnDateAsync`), so seeded rows never conflict and always carry an `EndTime`. **Two upcoming bookings deliberately break that rule**, one on a day the flagship no longer opens and one before it now opens: the schedule-conflict panel and its dashboard count only exist for a schedule narrowed after the bookings were taken, so without them the feature is invisible on the demo. A feature whose UI is driven by data state, rather than by a column, needs the state seeded or the demo silently stops exercising it.
- **Demo artwork is derived from disk, never hardcoded.** `MediaService` writes uploads into deterministic slots (`hero.<ext>`, `location-<id>.<ext>`, `menu-<id>.pdf`), so `demo_data.py config` leaves `ImageUrl`/`HeaderImageUrl` NULL and the `media` section (`--media-dir DIR`) emits UPDATEs for the files that actually exist. That is why an uploaded image survives a reseed, and why a hardcoded path can never point at a missing file. The media step only ever sets a URL, never nulls one, so it composes on top of `config`; a served `menu-<id>.pdf` wins over an external `menu_url` in the dataset. On the VPS, `data/media-snapshot/` is the curated source of truth — drop correctly-named files in there (or upload via the admin UI and re-snapshot) and they appear on the next reset. Anything not in the snapshot is wiped every run on purpose: demo admin credentials are public, so visitor uploads must not persist.
- **Migrations run against data, not an empty schema.** SQLite accepts `ALTER TABLE ADD COLUMN` with a non-constant default (`CURRENT_TIMESTAMP`, `CURRENT_DATE`, any parenthesised expression) only while the table is empty; with a single row present it fails with `Cannot add a column with non-constant default`. A fresh install's tables are empty at migration time and every real install's are not, so this shape passes locally, passes CI, and then breaks every upgrade. `AddMultiUserAccounts` shipped it and broke the VPS deploy. To add a column with a non-constant default: add it **nullable**, backfill with `migrationBuilder.Sql`, then rebuild the table (SQLite has no `ALTER COLUMN`) so both paths land on the same definition — see that migration for the pattern. `migration-check.yml` now seeds a row into every table (`scripts/fill-schema-fixture.py`) before applying the new migrations, so this class fails in CI instead of in production.
- **Migration safety invariant**: a new migration's `Up()` must produce an identical schema whether applied to a fresh database or an upgrade from the previous migration. The `migration-check.yml` CI workflow enforces this by generating SQL for both paths, applying them to SQLite, and diffing the schemas. If they diverge (e.g. `EnsureCreated` and `Migrate()` produce different column order or constraints), the check fails. Always verify that `dotnet ef migrations script "0" PREV_MIGRATION` + `dotnet ef migrations script PREV_MIGRATION` together match `dotnet ef migrations script`.
- **Auto-migration on startup**: `DatabaseExtensions.InitializeDatabase` calls `db.Database.Migrate()` with a retry loop before `app.Run()`. Fresh installs and upgrades are both handled automatically — no manual SQL steps needed.
- **Cross-platform image generation**: use `Magick.NET-Q8-AnyCPU` (ships Linux x64 native libs, no apt-get needed). Never add `Svg` (SVG.NET) — it uses `System.Drawing.Common` which is Windows-only in .NET 7+.
- **Default UI locale**: `BrandService.GetDefaultLocale` resolves `Locale:Default` configuration, then `OPENRESTO_DEFAULT_LOCALE` from the environment, validated against `SupportedLocales` (`en`, `fr`, `es`, `de`) and falling back to `en` — same shape as `GetWebsiteUrl`. Always populated on `GET /api/brand` as `defaultLocale`. It lives on the backend, not an `EXPO_PUBLIC_*` build arg, because the frontend Docker image is prebuilt for GHCR releases and a self-hoster can't rebuild it just to change language.

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
- **i18n is `i18next` + `react-i18next`**, one namespace (the default `translation`), never `i18n-js` (no React binding — nothing would re-render when the language changes). Locale JSON lives at `openresto-frontend/locales/{en,fr,es,de}.json`, root level and **not** under `app/` for the same reason component styles aren't: Expo Router would turn each into a route. Keys nest `area.screenOrComponent.concept` under exactly six top-level segments (`common`, `booking`, `restaurant`, `lookup`, `admin`, `errors`), named after the concept never the English text; `tests/i18n/parity.test.ts` keeps all four files key-identical to `en.json`, and `types/i18next.d.ts` module-augments `CustomTypeOptions` off `en.json` so a typo'd key at a `t()` call site fails `tsc`. `constants/locales.ts` mirrors the backend's `SupportedLocales.cs`. `LocaleContext` (mounted under `BrandProvider`, since it reads `brand.defaultLocale`) resolves the active locale highest-priority-first: `localStorage["openresto.locale"]` (a supported value only — written by `LanguageSwitcher`) → `brand.defaultLocale` → `DEFAULT_LOCALE` ("en"). Device locale is deliberately not in that chain. On resolve it calls both `i18n.changeLanguage()` and `setActiveLocale()` from `utils/locale.ts` — the second call is what makes every `utils/formatters.ts` date/time/number formatter follow the UI language instead of the device's. `constants/defaultCopy.ts` now holds only `loadingMessage` (rendered before any locale is known, so it stays hardcoded English on purpose). The one language picker is `components/common/LanguageSwitcher.tsx` (a `Select`, so it inherits `AnchoredPanel` and its listbox semantics) — mounted only in the admin `AdminSidebar` footer, which has no overflow menu of its own. The guest surface instead reaches locale switching through `components/layout/OverflowMenu.tsx`'s Language row, which opens a `ModalCard` listing `SUPPORTED_LOCALES` directly as `role="radio"` rows rather than nesting `Select` (and its own `AnchoredPanel`) inside a `menuitem` — see the "Anything hanging off a trigger" bullet below for why two anchored panels can't be live at once (issue #387). Both write paths call the same `LocaleContext.setLocale`, so the resolution effect and every switcher go through `LocaleContext`'s `applyLocale` helper, which is what stops them from drifting: a switch that called `i18n.changeLanguage` without `setActiveLocale` would flip every string to the new language while dates and numbers kept formatting in the old one, and would still pass a text-based test.
- Availability is fetched per `(restaurantId, date, seats)`. The API returns 30-minute slots with `{ time, isAvailable, availableTableIds, category }`. `PopularTimesPicker` shows only `isAvailable: true` slots; closed days return an empty slots array from the backend.
- Table holds flow: frontend calls `POST /api/holds` → backend validates open hours + pause state + conflict-checks → returns a `holdId` + expiry. The `holdId` must be included in the subsequent `POST /api/bookings` request.
- **Component styles live in a sibling `<Component>.styles.ts` exporting `styles`** — but **never inside `app/`**. Expo Router treats every module under `app/` as a route, so `app/admin/dashboard.styles.ts` becomes the route `/admin/dashboard.styles`, and — far worse — `app/admin/_layout.styles.ts` matches the `_layout` convention and is loaded as a _layout_, re-parenting every sibling route under `/admin/_layout.styles/...` so `/admin/dashboard` stops existing. Nothing catches this: `tsc`, Jest and lint all pass, and only an E2E run against real routing fails. Screen-level styles therefore live in `styles/` (mirroring the route tree: `styles/admin/dashboard.styles.ts`, `styles/user/lookup.styles.ts`); only styles for components under `components/` sit next to their component. The **Route Manifest** CI job (`npm run routes:check`) guards this: it exports the web build, derives the route list from the emitted HTML, and diffs it against `openresto-frontend/routes.snapshot.txt`. Intentional route changes need `npm run routes:update` and the snapshot committed — routes are public URLs, so changing one should be deliberate.
- **Admin settings is a route group, not a page**: `app/admin/settings/` holds one route per concern (`brand`, `email`, `users`, `account`) and an `index` that redirects to `brand`, so `/admin/settings` keeps working for old links. Each route is a thin list of cards inside `SettingsPage` (shared scroll container, title, and the 880px form column); the cards themselves are unchanged and still take the `borderColor`/`mutedColor`/`cardBg` palette from `useSettingsPalette`. `SettingsPage` also takes an optional `aside`, which renders in a sticky right-hand column above `SPLIT_MIN_WIDTH` (1100px) and stacks above the cards below it.
- **The brand route previews the home page live.** `/admin/settings/brand` is five cards (Brand Identity, Homepage Header, Contact & Website, Highlights, Footer) beside a `BrandPreview` aside. Each card owns its own subset of the brand record, which works because `PATCH /api/brand` reads null as "unchanged" and `""` as "clear" — a card must send `""`, never `undefined`, to clear a field it owns (the favicon deselect was broken for exactly this). The preview reads `BrandDraftContext`, not `BrandContext`: cards publish unsaved values via `useBrandDraftPublish`, so a field that only reaches `saveBrandSettings` won't appear until a reload. `BrandPreview` is a static miniature of `app/(user)/index.tsx`; both share their fallback copy (highlights heading/subheading, hero subtitle, "Our locations") through the same `restaurant.home.*` i18next keys, so the two can't drift the way two hand-copied strings could. `users.tsx` waits for `status !== "loading"` before gating on `can()`: an unresolved session has no role, so it would bounce an Owner on a cold load.
- **Editing an existing record autosaves; the admin's settings and locations forms have no Save button.** `useAutosave` (`hooks/use-autosave.ts`) takes `values` (the payload as it would be sent), `saved` (same shape, from the server-backed context) and `save`; `SaveStatus` renders the outcome where the button was. Both are compared serialised, so fresh object literals per render are fine. Four things bite: (1) the context doesn't refetch after a write, so the hook treats its last committed payload as the baseline — reading dirtiness from `saved` alone re-sends forever; (2) `canSave` withholds writes the server would reject mid-keystroke, and every rule it encodes must mirror a real backend one; (3) a pending debounce flushes on unmount, so `save` must close over the right record id; (4) with no button to grey out, a silent withheld write reads as a broken autosave — state the reason instead (`RestaurantInfoForm` derives a `blockedReason` and renders it where `SaveStatus` sits). `saveBrandSettings` returns `AdminMutationResult`, so success is `result.ok`, never a substring check on the message. Undo works on committed state, not uncommitted edits, which is why it replaced Discard: pass `onRestore` and the hook offers a single-level `undo` for `undoWindow` (10s) after a write lands, putting the old payload back into both the form and the server. Supplying `onRestore` is what enables it — without a way to move the inputs back, undoing would write the old values while the form kept showing the new ones and the next keystroke would re-save them. `undo` commits its target as the baseline before restoring, so the restored values aren't detected as a fresh edit and written twice.
- **Anything hanging off a trigger is `components/common/AnchoredPanel`.** React Native has no popover primitive, which is why the app grew four hand-rolled ones (issue #348). The shared shell owns the `Modal`, the dismiss backdrop, the position, focus in and out, and forwarding keys; the geometry is `utils/anchoredPanel.ts` (flip up when the list would run off the bottom, clamp at a screen edge, `align: "end"` for a panel wider than its trigger) and the tracking is `hooks/use-anchor-tracking.ts`, which re-measures on scroll and resize. Web hangs the panel off the trigger; native, and any web trigger that reports no box, gets a centred sheet. Two rules are easy to break: the panel is the **one** focus target and navigates by `aria-activedescendant`, so its rows carry `tabIndex={-1}` and never take focus themselves (fifty rows in the tab order is not a control anyone gets past); and `role` is what the panel _is_, so a list of values is a `listbox` of `option`s under a `combobox` trigger and only a list of commands is a `menu`. Key handling is `utils/listboxKeys.ts`, a pure resolver, so every key is pinned by a unit test rather than by a browser. React Native's `Role` union omits `listbox`, hence `LISTBOX_ROLE` in `utils/webProps.ts`, which is also where the `aria-*` and `onKeyDown` props RNW forwards but RN does not type live, so no call site needs `as any`.
- **Buttons are one primitive, two layouts.** Every button in the app is `components/common/Button` — there is no second way to draw one, and a `Pressable` styled to look like a button is a bug. Its two axes are independent: `variant` is weight (`primary` filled / `secondary` outlined / `ghost` bare) and `tone` is meaning (`brand` / `danger` / `warning` / `success` / `neutral`), so "Remove image" and "Yes, delete permanently" are the same destructive control at two weights rather than two hand-rolled styles. `variant="danger"` is a kept alias for filled-destructive. Sizes: the admin uses `size="md"` (44px, the WCAG 2.5.5 target) for every action; `lg` is for a focused form's own submit (login, the booking form); `sm` is the row scale. Buttons group through `components/common/ButtonRow`, whose children keep their natural width — it wraps rather than using a breakpoint, so a cluster too wide for its card drops to a second line instead of one button stretching full-width while its neighbour shrinks. Source order is reading order: **dismissing and destructive actions first, the primary last**, and a cluster gets **one** filled button. `fullWidth` is opt-in and reserved for a form's single submit. **Row-level actions** (a list row's trailing cluster) are `components/common/RowTextButton` — a named pill, never a bare glyph, because the admin runs on tablets for staff who are not in it daily; it reaches 44px through hitSlop so rows stay dense. Icon-only controls (`IconButton`) are for the handful of universally-read glyphs in genuinely constrained chrome — a modal close, a reorder arrow, a date-bar chevron — and always carry an `accessibilityLabel`.
- **A filled button means create or commit, never "save".** Autosave took "save" away from field edits, leaving the filled button one honest meaning: it makes something new, or does something you can't walk back. A list's standing create CTA is `AddRow` (collapsed to one `Add X`, expanded to fields plus Cancel/Add) in `<ButtonRow align="start">`, flush with the rows it appends to. A form serving both new and existing rows (`SocialLinkEditForm`, `HighlightsCard`'s editor) takes `isNew` and labels the commit **Add** or **Save** to match; a create labelled "Save" is the bug this rule catches. Deliberate explicit-press carve-outs: `SecurityCard` (the press is the confirmation for a credential change), `EmailSettingsCard` (`sendBookingConfirmations` ships with the SMTP credentials and `handleTest` saves before testing, so a debounce would put half-typed credentials on the wire and test against them), `BookingDetailPopup` and `DangerZone` (guest-visible or irreversible), and `TableRow` (its Cancel genuinely reverts).
- **Chrome favicon caching**: never update `<link rel="icon">` href in-place — Chrome ignores it. Remove all existing favicon links then append a fresh `<link>` element to force re-read.
- **PWA manifest URL**: must remain a same-origin HTTP(S) URL. Replacing `<link rel="manifest">` href with a `blob:` URL silently breaks Chrome's PWA installability check.
- **SW cache versioning**: bump `CACHE_NAME` in `public/sw.js` on every deploy that changes `public/manifest.json`, otherwise browsers serve the stale cached manifest.
- Tab favicon (SVG data URI via `injectBrandFavicon`) works in standalone dev. PWA install icon requires Docker — nginx must proxy `/api/brand/pwa-icon-*.png` to the backend.
- `app/+html.tsx` is Expo Router's HTML `<head>` template for static output mode — favicon link, manifest link, and SW registration script all live here.
- **Cross-platform scroll-to-element**: to smoothly scroll a `ScrollView` to a specific child after it appears, use two paths: on web call `(ref.current as unknown as HTMLElement).scrollIntoView?.({ behavior: "smooth", block: "start" })`; on native call `findNodeHandle(scrollRef.current)` then `childRef.current.measureLayout(node, (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }), () => {})`. Wrap in a `setTimeout` of ~150 ms so layout settles before measuring. See `components/restaurant/LocationsScreen.tsx` (scrolling to a deep-linked/expanded location). `/lookup` used to be the worked example here but dropped its auto-scroll when the found/cancelled/past result moved into a `SlidePanel` beside the form — the panel is already in view on desktop and the bottom sheet owns the viewport on compact, so there is nothing left to scroll to.
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

**Admin API keys** — the headless credential for `openresto-cli` and integrations (issue #319). `AdminApiKey` rows hold a SHA-256 of the raw `orst_<id>_<secret>` key (deliberately a fast hash, not `IPasswordService` PBKDF2 — the secret is 256 bits of CSPRNG output verified on every request; `ApiKeyCrypto` documents this). Presented via `X-API-Key`, never `Authorization`; the `AdminAuth` policy scheme forwards to the `ApiKey` handler when the header is present, else JWT, so policy-gated controllers accept either. Role and active status resolve live from the `AdminCredential` row at auth time — nothing is baked into the key. Keys are self-scoped PAT-style: an Owner mints/lists/revokes only their own, revoke is soft (`RevokedAt`) so audit entries keep resolving.

Five invariants:

- **Every `RequireAdmin`/`RequireOwner` action carries exactly one of `[RequiresScope]`, `[NoApiKeyAccess]`, or `[AllowAnyApiKey]`** — `ApiKeyScopeCoverageTests` reflects over all of them and fails otherwise, same structural floor as the audit coverage test. Scope resources (`ApiKeyScopes`) mirror the `AuditActions` noun groups; `audit` and `guests` are read-only; a `write` grant satisfies a `read` requirement, never the reverse.
- **The v1-excluded surface stays excluded**: auth self-service, email settings, notifications/push, and key management itself are `[NoApiKeyAccess]`. The one any-key endpoint is `GET api/admin/api-keys/self` (backs `openresto auth whoami`).
- **`guests` is a DTO redaction, not a gate**: a key with `bookings:read` but no `guests:read` gets bookings with customer name/email nulled, through `BookingGuestVisibility` only — never re-derive the condition at a call site.
- **The global rate limiter partitions keyed requests per client IP** (`apikey-ip:<ip>`, higher ceiling), never per header value — the limiter runs pre-auth, so a per-value partition would let rotated garbage headers mint unlimited buckets.
- **Audit rows name the acting key** (`AuditLogMiddleware` appends the key name to the actor display name), which is why `Name` is required at mint.

### The CLI and its OpenAPI contract

`openresto-cli/` is a standalone TypeScript package (Node 24, `commander` as the only runtime dep), versioned independently at 0.1.0 — deliberately **not** wired into `scripts/check-release-version.sh` or the release workflow, and not published to npm yet. User docs live in `openresto-cli/README.md`. Two conventions are load-bearing:

- **The API key is never accepted as argv** (`ps` exposure — the same rule `scripts/demo_data.py` follows for the admin password). `auth login` prompts with hidden input or reads stdin; `OPENRESTO_URL`/`OPENRESTO_API_KEY` env vars override the `~/.config/openresto/config.json` profile (written mode 0600).
- **The committed contract must match the controllers byte-for-byte.** `tools/OpenApiExport` boots the real API in-process (`WebApplicationFactory`, in-memory SQLite — build-time MSBuild generation was tried and rejected; the tool's doc comment says why) and writes `openresto-cli/openapi/v1.json`; `openapi-typescript` compiles it to `openresto-cli/src/generated/api.d.ts`. The `openapi-drift` CI job regenerates both and fails on any diff, so an API-shape change must ship with:

  ```bash
  dotnet build
  cd tools/OpenApiExport && dotnet run --no-build -- ../../openresto-cli/openapi/v1.json
  cd ../../openresto-cli && npm run generate:types
  ```

  Both files are listed in `.prettierignore` on purpose: the drift check compares against what the generators emit, so no formatter may touch them. Commands are hand-written over the generated types — don't let generated operation names dictate CLI structure.

### Admin audit trail

`AdminAuditEntry` is an append-only record of who did what, surfaced at `/admin/activity`. Six things about it are easy to get wrong:

- **Coverage is structural, not a list.** `AuditLogMiddleware` writes a row for every mutating request to an endpoint gated by `RequireAdmin`/`RequireOwner` (`AuditRequestClassifier`), so an endpoint added tomorrow is audited the day it ships. `IAuditScope` only adds the readable part on top — a domain action key from `AuditActions`, a target, a summary, a diff. An unenriched request still lands a row keyed `http.post`. The corollary is that a gate which names no policy (a bare `[Authorize]`, or one listing raw roles) is invisible to the floor; `AuditCoverageTests` reflects over every controller action and fails on one.
- **The middleware is outermost in `Program.cs`, above `UseExceptionHandler`.** It records after the pipeline unwinds, so `Response.StatusCode` is the 400 the caller actually received rather than the 200 it still was inside MVC's filters, and `RemoteIpAddress` is the client's as rewritten by `UseForwardedHeaders`. Moving it inwards silently changes both.
- **The write uses its own DI scope.** Sharing the request's `DbContext` would make the audit `SaveChanges` flush whatever a half-finished service left tracked on it — committing, as a side effect of logging, the mutation that threw.
- **Entries never carry secrets or customer PII.** `ChangesJson` is only ever written by a service naming a field through `RecordChange`, so the recorded set is an allow-list by construction; `AuditFields.IsProtected` masks the value on top of that, for credentials and for customer identity alike. Booking history is deliberately GDPR-purgeable, so entries reference bookings by ref and id only — never a customer name, email or phone, in `TargetLabel` or `Summary` either. `Path` is stored without its query string for the same reason (admin list screens filter by customer email).
- **There is no write and no delete endpoint.** An admin who can erase the audit log has no audit log. Rows leave only through `AuditRetentionService` (default 365 days, `Audit:RetentionDays`, driven daily by `AuditRetentionWorker`). The demo reset wipes the table for a sharper reason: the demo's admin password is public, so its entries are visitors' actions and visitors' IPs shown to every other visitor.
- **Services take `IAuditScope? audit = null`** as an optional last constructor parameter, falling back to `NullAuditScope.Instance`. That is what keeps the ~30 test classes that construct services by hand compiling with no arrangement.

### Brand / Favicon

- `BrandSettings.FaviconIcon` — nullable string (max 32 chars), validated server-side against `LucideIconPaths.cs` (15 icons: utensils, wine, coffee, pizza, flame, leaf, star, heart, chef-hat, fish, hamburger, sandwich, soup, cake, ice-cream-cone).
- `GET /api/brand/pwa-icon.svg` — SVG with brand-colored rounded-rect background + white Lucide icon; used for the browser tab favicon.
- `GET /api/brand/pwa-icon-{192|512}.png` — PNG generated via `Magick.NET-Q8-AnyCPU`; used as PWA manifest icons. Both return 404 when no icon is configured; Chrome falls back to static PNGs.
- Frontend: `utils/injectBrandFavicon.ts` runs from `BrandContext` after brand loads and posts `BRAND_UPDATE` to the SW to patch the manifest `name`/`theme_color`. Icon picker in `BrandSettingsCard`; SVG path data + `buildFaviconDataUri()` in `constants/faviconIcons.ts`.

### Deletion & cascade behaviour

**Table / Section deletion** — `Booking.TableId` and `Booking.SectionId` are **nullable** (`int?`). Deleting a table or section does **not** cascade-delete its bookings; instead, `DeleteTableAsync` and `DeleteSectionAsync` in `RestaurantManagementService` explicitly null those FK columns on affected bookings before removing the parent row. The DB FK is `ON DELETE SET NULL`. `ToDetailDto` in `AdminService` returns `"Table"` / `"Section"` as display fallbacks when the FK is null.

**Restaurant deletion is archive-then-purge, enforced server-side.** `DELETE /admin/restaurants/{id}` cascades to every section, table and booking, so `AdminService.DeleteRestaurantAsync` throws a `BusinessRuleException` unless the restaurant is already `IsArchived` — the two-step is a rule, not a UI convention, and the archive step _is_ the undo. The endpoint and its `GET /admin/restaurants/{id}/delete-preview` preflight (section/table/group/booking counts for the confirmation) are both `RequireOwner`, matching user management; the frontend mirrors that with the `delete:location` capability.

`/admin/locations` has **one location selector**, listing archived locations alongside active ones. Two selectors on that screen (a page picker plus a Danger Zone picker) is what let an admin edit one location and destroy another, and is why `DangerZone` is gone. Archive lives at the foot of the selected location's card behind a confirm sheet; selecting an archived location swaps the editable card for `ArchivedLocationPanel` (read-only, one-press Restore, and — Owner only — the delete flow). Restore has no confirmation on purpose: reversible actions do not get gates. `RestaurantDto` never carries archived rows, so the archived panel renders from the admin lookup list, and both archive and restore refetch `fetchRestaurants()` afterwards.

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
