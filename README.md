# OpenResto

[![Frontend Coverage](https://img.shields.io/coveralls/github/karanshukla/openresto/main?flag=frontend&label=frontend%20coverage)](https://coveralls.io/github/karanshukla/openresto)
[![Backend Coverage](https://img.shields.io/coveralls/github/karanshukla/openresto/main?flag=backend&label=backend%20coverage)](https://coveralls.io/github/karanshukla/openresto)

A self-hosted restaurant booking management system. Customers browse restaurants, hold tables in real-time, and book instantly. Admins manage reservations, tables, sections, and branding from a dedicated dashboard.

<img width="1008" height="872" alt="image" src="https://github.com/user-attachments/assets/5e6d1099-8c4b-4163-b037-d71816726136" />

<img width="1151" height="718" alt="image" src="https://github.com/user-attachments/assets/bb3e9ef8-35b3-4acd-a9ec-fe9dfc5360c8" />

<img width="294" height="668" alt="image" src="https://github.com/user-attachments/assets/5961e99d-c382-4082-afdc-e7d1d85d82a2" />

<img width="297" height="677" alt="image" src="https://github.com/user-attachments/assets/5ed6b3f5-67e8-4097-8a9c-865e13115b7e" />

<img width="290" height="675" alt="image" src="https://github.com/user-attachments/assets/33978571-c6db-4e53-a374-56c284cabc5f" />

<img width="294" height="672" alt="image" src="https://github.com/user-attachments/assets/33e69025-d60f-414f-a647-db0eb231b26f" />


## Tech Stack

| Layer    | Technology                                                      |
| -------- | --------------------------------------------------------------- |
| Backend  | ASP.NET Core 10, C#, Entity Framework Core, SQLite              |
| Frontend | React Native (Expo Router)
| Auth     | JWT Bearer Tokens (HS256)                                       |
| Email    | MailKit (SMTP)                                                  |
| Infra    | Docker Compose, Nginx reverse proxy                             |

## Architecture

```mermaid
flowchart TD
    Client(["Browser / Mobile"])

    subgraph compose["Docker Compose — localhost:5062"]
        Nginx["Nginx Reverse Proxy"]

        subgraph fe_container["Frontend Container"]
            FE["Expo / React Native\n:8081"]
        end

        subgraph be_container["Backend Container"]
            API["ASP.NET Core 10\n:8080"]
            DB[("SQLite")]
        end

        Vol[("media_data\nShared Volume")]
    end

    SMTP(["SMTP Server"])

    Client -- "HTTP :5062" --> Nginx
    Nginx -- "/*" --> FE
    Nginx -- "/api/*" --> API
    Nginx -- "/media/*" --> Vol
    API --- DB
    API -- "MailKit" --> SMTP

    classDef container fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    classDef storage fill:#fef9c3,stroke:#ca8a04,color:#3d2b00
    classDef external fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef proxy fill:#fce7f3,stroke:#db2777,color:#500724

    class FE,API container
    class DB,Vol storage
    class SMTP,Client external
    class Nginx proxy
```

## Quick Start

### Docker (recommended)

For local development:

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

## Testing

```bash
# Backend tests
dotnet test

# Frontend tests (100% coverage target)
cd openresto-frontend && npm test

# Full frontend coverage report
cd openresto-frontend && npm test -- --coverage
```

## Key Features

- **Multi-restaurant support** — manage multiple locations from one instance
- **Real-time table holds** — 5-minute holds prevent double-booking during checkout
- **Intelligent Loading System** — branded splash screens and high-performance skeleton loaders
- **Admin dashboard** — live bookings, availability grid, status filtering (active/past/cancelled)
- **Booking management** — create, extend, cancel; view by reference
- **Customizable branding** — app name, primary color, logo (stored in DB, no CDN needed)
- **Email notifications** — configurable SMTP for booking confirmations
- **Privacy-focused** — GDPR notice on booking, hard-delete capability for admins
- **Secure cookies** — recent bookings stored in encrypted HttpOnly cookies
- **Self-hosted** — runs on any VPS with Docker, no external dependencies

## License

MIT, do what you want with it
