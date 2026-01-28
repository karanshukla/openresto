# OpenResto - Docker Setup Guide

This guide explains how to run the OpenResto app in different environments.

## Quick Start - Production Mode

Run the full stack with production builds:

```bash
docker-compose up
```

Access the app at: **http://localhost:5062**

Services:

- Frontend: http://localhost:8081 (direct)
- Backend API: http://localhost:8080 (direct)
- Nginx Reverse Proxy: http://localhost:5062 (main entry point)

## Development Mode - With Hot Reload

Run with hot reload enabled for frontend development:

```bash
docker-compose --profile dev up
```

Access the app at: **http://localhost:8081**

This mode:

- ✅ Enables hot reload for frontend code changes
- ✅ Uses Expo Metro dev server
- ✅ Mounts local code volume for live updates
- ✅ Backend still runs in Docker

## Local Development - No Docker

Run both services locally in VS Code:

### Frontend (Expo Web)

```bash
cd openresto-frontend
npm install
expo start --web
```

Access at: **http://localhost:8081**

### Backend (C# / ASP.NET Core)

Open `openresto.sln` in VS Code and run the backend directly.
You can also use dotnet run from the terminal:

```bash
dotnet run --launch-profile Development
```

API runs at: **http://localhost:8080**

## Configuration Files

- **Dockerfile** - Production build (expo export + serve)
- **Dockerfile.dev** - Development build (Expo dev server with hot reload)
- **docker-compose.yml** - Multi-container orchestration
- **nginx.conf** - Reverse proxy configuration
- **.env.docker** - Environment variables for Docker containers

## Ports Reference

| Port        | Service             | Mode     |
| ----------- | ------------------- | -------- |
| 5062        | Nginx Reverse Proxy | All      |
| 8081        | Frontend            | All      |
| 8080        | Backend API         | All      |
| 19000-19002 | Expo Dev Server     | Dev only |

## Troubleshooting

### Frontend not accessible

```bash
# Check if containers are running
docker ps

# View frontend logs
docker logs openresto-frontend-1

# Restart the stack
docker-compose down
docker-compose up
```

### Hot reload not working (dev mode)

Make sure the volume mount is correct in docker-compose.yml and that code changes are saved.

### Port already in use

```bash
# Stop Docker Desktop and free the ports, or change ports in docker-compose.yml
docker-compose down
```

## Development Workflow

1. **During development**: Use local dev mode or Docker dev profile with hot reload
2. **Before deployment**: Test with production mode (`docker-compose up`)
3. **For CI/CD**: Use production Dockerfile only
