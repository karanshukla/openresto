# OpenResto

A self-hosted restaurant booking management system. Customers browse restaurants, hold tables in real-time, and book instantly. Admins manage reservations, tables, sections, and branding from a dedicated dashboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | ASP.NET Core 10, C#, Entity Framework Core, SQLite |
| Frontend | React Native (Expo Router), TypeScript, NativeWind/Tailwind CSS |
| Auth | JWT Bearer Tokens (HS256) |
| Email | MailKit (SMTP) |
| Infra | Docker Compose, Nginx reverse proxy |

## Quick Start

### Docker (recommended)

```bash
docker-compose up
```

- App: http://localhost:5062
- API: http://localhost:8080
- Frontend dev: http://localhost:8081

### Local Development

**Prerequisites:** .NET 10 SDK, Node.js 20+

```bash
# Backend
cd OpenRestoApi
dotnet watch run
# → http://localhost:5062

# Frontend (separate terminal)
cd openresto-frontend
npm install
npm run web
# → http://localhost:8081
```

The SQLite database is created automatically on first run.

## Project Structure

```
openresto/
├── OpenRestoApi/                # ASP.NET Core API
│   ├── Controllers/             # API endpoints
│   ├── Core/
│   │   ├── Domain/              # Entities (Booking, Restaurant, Table, etc.)
│   │   └── Application/         # DTOs, interfaces, services, mappings
│   └── Infrastructure/          # EF Core, email, auth, holds, cookies
├── OpenRestoApi.Tests/          # xUnit + Moq tests
├── openresto-frontend/          # Expo/React Native app
│   ├── app/                     # File-based routing
│   │   ├── (user)/              # Customer routes (book, lookup, search)
│   │   └── (admin)/             # Admin routes (dashboard, bookings, settings)
│   ├── api/                     # API client layer
│   ├── components/              # React components
│   ├── context/                 # State management (Theme, Brand)
│   └── hooks/                   # Custom hooks
├── docker-compose.yml           # Multi-container orchestration
└── nginx.conf                   # Reverse proxy config
```

## Configuration

### Backend

Set via environment variables or `appsettings.json`:

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_KEY` | JWT signing key (min 32 chars) | Dev key in appsettings |
| `CONNECTION_STRING` | SQLite connection string | `Data Source=./openresto.db` |
| `CORS_ORIGINS` | Comma-separated allowed origins | localhost ports |
| `Admin:Email` | Default admin email | Set in appsettings |
| `Admin:Password` | Default admin password | Set in appsettings |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5062` |

## Testing

```bash
# Backend tests
dotnet test

# Backend tests with coverage
dotnet test --collect:"XPlat Code Coverage"

# Frontend lint
cd openresto-frontend && npm run lint

# Frontend format check
cd openresto-frontend && npx prettier --check "**/*.{ts,tsx,js,json}"
```

## Key Features

- **Multi-restaurant support** — manage multiple locations from one instance
- **Real-time table holds** — 5-minute holds prevent double-booking during checkout
- **Admin dashboard** — live bookings, availability grid, status filtering (active/past/cancelled)
- **Booking management** — create, extend, cancel; view by reference
- **Customizable branding** — app name, primary color, logo (stored in DB, no CDN needed)
- **Email notifications** — configurable SMTP for booking confirmations
- **Privacy-focused** — GDPR notice on booking, hard-delete capability for admins
- **Secure cookies** — recent bookings stored in encrypted HttpOnly cookies
- **Self-hosted** — runs on any VPS with Docker, no external dependencies

## License

All rights reserved.
