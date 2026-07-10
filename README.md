# OpenResto

[![Release](https://img.shields.io/github/v/release/karanshukla/openresto)](https://github.com/karanshukla/openresto/releases/latest)
[![CI](https://github.com/karanshukla/openresto/actions/workflows/ci.yml/badge.svg)](https://github.com/karanshukla/openresto/actions/workflows/ci.yml)
[![Coverage](https://coveralls.io/repos/github/karanshukla/openresto/badge.svg?branch=main)](https://coveralls.io/github/karanshukla/openresto)
[![OWASP ZAP](https://img.shields.io/badge/OWASP%20ZAP-scanned-5C2D91?logo=owasp&logoColor=white)](https://www.zaproxy.org/)
[![.NET 10](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![PWA](https://img.shields.io/badge/Expo%20Router-PWA%20ready-000020?logo=expo&logoColor=white)](https://expo.dev/router)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![GHCR](https://img.shields.io/badge/GHCR-multi--arch-0d1117?logo=github&logoColor=white)](https://github.com/karanshukla/openresto/pkgs/container/openresto-backend)
[![Zero external services](https://img.shields.io/badge/external%20services-zero-22c55e)](https://github.com/karanshukla/openresto)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b.svg)](https://opensource.org/licenses/MIT)
[![Made in Canada](https://img.shields.io/badge/Made%20in-Canada%20🍁-d52b1e)](https://github.com/karanshukla/openresto)
[![Made in Australia](https://img.shields.io/badge/Made%20in-Australia%20🦘-00843d)](https://github.com/karanshukla/openresto)
[![Assisted by Claude Code](https://img.shields.io/badge/Assisted%20by-Claude%20Code-CC785C?logo=anthropic)](https://claude.ai/code)

A self-hosted, zero-dependency restaurant booking system. Customers browse restaurants, hold tables in real-time, and book instantly. Admins manage reservations, tables, floor sections, branding, and booking pauses from a dedicated dashboard - all from a single Docker Compose command with no external services required beyond optional SMTP.

**[Live Demo](https://openres.to)** - admin: `example@example.com` / `password` · resets every 2 hours, feel free to play around and change anything

## Philosophy

The Restaurant business has changed. Indie restaurants run on razor thin margins, and the cost of SaaS booking platforms only adds to the burden. Users don't want to install another app, give up their phone number to the cloud, or create another account to remember. OpenResto was designed to be as simple as possible for both customers and restaurant owners, while still being fully self-hosted, secure and customisable. Owners can manage bookings easily without friction. Customers book instantly without giving up any personal information, and can easily save their reservations to their calendar. Nothing in between.

## Screenshots

### Desktop

<img src="https://github.com/user-attachments/assets/5e6d1099-8c4b-4163-b037-d71816726136" width="700" alt="Dashboard overview">

<img src="https://github.com/user-attachments/assets/ce52d6ed-6989-490c-b950-81777eefa14a" width="750" alt="Booking interface">

<img src="https://github.com/user-attachments/assets/3b5b5892-869f-413d-89ef-ee96d78aaa99" width="700" alt="Restaurant search">

<img width="700" alt="Screenshot 2026-06-26 154244" src="https://github.com/user-attachments/assets/72242735-468b-42a3-9f3a-7a1261bc70c4" />

### Mobile

<img src="https://github.com/user-attachments/assets/e24084f2-ca02-4740-9900-101bbfbe1203" width="320" alt="Mobile dashboard">

<img src="https://github.com/user-attachments/assets/f6462b92-d45c-467d-9ed3-8852ff7c0d45" width="320" alt="Mobile booking">

## Tech Stack

| Layer        | Technology                                                                   |
| ------------ | ---------------------------------------------------------------------------- |
| Backend      | ASP.NET Core 10, C#, Entity Framework Core, SQLite                           |
| Frontend     | React Native (Expo Router) — web + mobile from one codebase                  |
| Auth         | JWT Bearer Tokens (HS256), encrypted HttpOnly cookies                        |
| Image gen    | Magick.NET-Q8-AnyCPU (cross-platform, no native deps)                        |
| Email        | MailKit (SMTP)                                                               |
| Infra        | Docker Compose, Nginx reverse proxy                                          |
| Security CI  | OWASP ZAP API scan on every push (OpenAPI-driven, rules in `.zap-rules.tsv`) |
| Code mappers | Mapperly (source-gen, zero reflection)                                       |

## Quick Start

### Self-hosted install (pre-built images — recommended for production)

Download the `docker-compose.yml` from the [latest release](https://github.com/karanshukla/openresto/releases/latest), create a `.env` file based on [`.env.example`](.env.example), then:

```bash
docker compose up -d
```

Pre-built `linux/amd64` and `linux/arm64` images are pulled from GHCR — no build step, works on Pi/NAS boxes out of the box. The backend applies any pending database migrations automatically before accepting traffic.

For backup and restore procedures, see [`docs/backup-restore.md`](docs/backup-restore.md).

### Docker (build from source)

For local development:

```bash
docker compose up
```

- App: http://localhost:5062
- API: http://localhost:8080
- Frontend dev: http://localhost:8081

### Local Development

**Prerequisites:** .NET 10 SDK, Node.js 20+

```bash
# run from the repo root
npm run dev 
```
The SQLite database is created automatically on first run. Since this is not running via docker, Images and other media will not work, however HMR is enabled. 

## Configuration

### Backend

Set via environment variables or `appsettings.json`:

| Variable            | Description                     | Default                      |
| ------------------- | ------------------------------- | ---------------------------- |
| `JWT_KEY`           | JWT signing key (min 32 chars)  | Dev key in appsettings       |
| `CONNECTION_STRING` | SQLite connection string        | `Data Source=./openresto.db` |
| `CORS_ORIGINS`      | Comma-separated allowed origins | localhost ports              |
| `Admin:Email`       | Default admin email             | Set in appsettings           |
| `Admin:Password`    | Default admin password          | Set in appsettings           |

### Frontend

| Variable              | Description          | Default                 |
| --------------------- | -------------------- | ----------------------- |
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5062` |

The VAPID key variables are also required for push notification support, but are optional for developing.

## Testing

```bash
# Backend tests
dotnet test

# Frontend tests (100% coverage target)
cd openresto-frontend && npm test

# Full frontend coverage report
cd openresto-frontend && npm test -- --coverage
```
Note: VSCode may not pick up on the Jest config, unless you use the command palette to activate all the test runners.

## Key Features

### Booking flow

- **Real-time table holds** — when a customer selects a time slot, a 5-minute hold is placed on the specific table via a thread-safe in-memory `ConcurrentDictionary`. The `holdId` must be echoed back at booking time, preventing any other customer from snatching the same table during checkout. Holds auto-expire and are released atomically if the customer changes their selection.
- **Popular-times categorisation** — every 30-minute slot is tagged `Lunch`, `Dinner`, or `Off-Peak` using restaurant industry data (Toast/Square/Yelp benchmarks). The frontend groups available slots into labelled pill tabs so customers can quickly jump to the time period they want.
- **Paused bookings** — admins can halt new reservations until a specific date/time (e.g. during a private event) without touching any configuration files. The availability API checks `BookingsPausedUntil` before returning slots.
- **IANA timezone awareness** — all `DateTime` values are stored in UTC. Restaurant-local open/close hours and slot generation are computed using the restaurant's IANA timezone (`America/New_York`, `Europe/London`, …), so the availability calendar is always correct regardless of where the server runs.

### Admin & management

- **Multi-restaurant support** — manage multiple locations from one instance; each has its own tables, sections, hours, timezone, and branding.
- **Floor sections** — tables are grouped into named sections (e.g. "Patio", "Bar", "Main") so admins can organize seating and customers see which section they're booking.
- **Admin dashboard** — live bookings list with status filtering (active / past / cancelled), extend or cancel reservations, and a customer-name field for front-of-house use.
- **Booking pause** — temporarily suspend new reservations for a restaurant without taking it offline or editing config.

### Branding & UI

- **Full white-label branding** — app name, primary color, favicon icon, and PWA identity are all stored in the database and configurable from the admin settings panel. Choose from 15 Lucide icons (utensils, wine, coffee, pizza, flame, leaf, star, heart, chef-hat, fish, hamburger, sandwich, soup, cake, ice-cream-cone); the favicon updates live in the browser tab without a page reload. The frontend fetches brand settings on boot and applies them globally via `BrandContext`.
- **Dynamic PWA icons** — `GET /api/brand/pwa-icon.svg` returns an SVG with the brand-colored background and white icon on the fly. `GET /api/brand/pwa-icon-{192|512}.png` rasterizes it with Magick.NET (cross-platform, no ImageMagick apt package needed) for PWA manifest compliance.
- **Skeleton loaders & splash screens** — branded loading states throughout the app; no blank white flashes.

### Security & privacy

- **OWASP ZAP API scan in CI** — every push runs a ZAP API scan against the full Docker stack, using the OpenAPI spec (`/openapi/v1.json`) to discover all endpoints automatically. Ignored rules are tracked in `.zap-rules.tsv`.
- **Rate limiting** — ASP.NET Core built-in rate limiting on sensitive endpoints.
- **Encrypted recent-bookings cookie** — HttpOnly cookie using ASP.NET Core Data Protection so customers can look up their recent reservations without an account.
- **Hard-delete** — admins can permanently erase booking records for GDPR compliance. A GDPR notice is shown on the booking form.
- **No accounts needed** — customers identify via a short `BookingRef` code; no email verification loop.

### Developer experience

- **Single command dev** — `npm run dev` starts the .NET backend (hot reload) and Expo frontend concurrently.
- **100% frontend coverage target** — Jest + React Native Testing Library; Playwright E2E tests against the live Docker stack.
- **Mapperly source-gen mappers** — zero runtime reflection, compile-time DTO mappings.
- **Self-hosted** — runs on any VPS, Pi, or NAS with Docker; SQLite included, no managed database or CDN required.
- **Auto-migrations on startup** — the backend runs `Database.Migrate()` before accepting traffic; upgrading is `docker compose pull && docker compose up -d`.
- **Migration safety CI** — every PR that adds an EF Core migration generates SQL for both a fresh install and an upgrade from the previous state, applies both to SQLite, and asserts the schemas are identical. Catches migration bugs before they reach self-hosters.
- **Multi-arch releases** — `linux/amd64` and `linux/arm64` images published to GHCR on every semver tag; Pi/NAS users get native binaries.

## Cutting a release

1. **Update `CHANGELOG.md`** — add a `## [x.y.z] - YYYY-MM-DD` section at the top of the file.

2. **Merge to main** — all CI must be green before tagging.

3. **Tag and push:**

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **That's it.** The [`release.yml`](.github/workflows/release.yml) workflow triggers automatically and:
   - Builds `linux/amd64` + `linux/arm64` Docker images for the backend, frontend, and nginx proxy
   - Pushes them to GHCR as `ghcr.io/karanshukla/openresto-{backend,frontend,nginx}:v1.0.0` (and `:latest`)
   - Creates a GitHub Release with the `[x.y.z]` section from `CHANGELOG.md` as the release notes
   - Attaches a pinned `docker-compose.yml` (with the exact image tag baked in) as a downloadable release asset — this is what self-hosters download

## License

MIT, do what you want with it
