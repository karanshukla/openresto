# Nginx VPS Configuration with PositiveSSL

This directory contains a specialized Nginx configuration designed for Namecheap VPS hosting using PositiveSSL.

## Features
- HTTP (Port 80) to HTTPS (Port 443) redirect.
- SSL/TLS configuration optimized for PositiveSSL.
- Security headers included (OWASP best practices).
- Reverse proxy for Backend (API) and Frontend.
- Dynamic configuration via environment variables.

## SSL Certificate Preparation
PositiveSSL usually provides two main files:
1. `your_domain.crt`
2. `your_domain.ca-bundle`

Nginx requires the full certificate chain in a single file. You must concatenate them:

```bash
cat your_domain.crt your_domain.ca-bundle > server.crt
```

You should also have your private key:
- `server.key` (This was generated when you created the CSR).

## Deployment

### 1. Place SSL Files
Ensure `server.crt` and `server.key` are available on your VPS.

### 2. Run with Docker Compose
If you are using Docker Compose, mount the SSL files and set the `DOMAIN_NAME`:

```yaml
services:
  nginx:
    build: ./nginx-vps
    ports:
      - "80:80"
      - "443:443"
    environment:
      - DOMAIN_NAME=yourdomain.com
      - BACKEND_HOST=api-service
      - BACKEND_PORT=8080
      - FRONTEND_HOST=frontend-service
      - FRONTEND_PORT=8081
    volumes:
      - /path/to/your/ssl/server.crt:/etc/nginx/ssl/server.crt:ro
      - /path/to/your/ssl/server.key:/etc/nginx/ssl/server.key:ro
    restart: always
```

### 3. Non-Docker Deployment
If you are installing Nginx directly on the VPS (e.g., `apt install nginx`):

1. Copy `security-headers.conf` to `/etc/nginx/conf.d/`.
2. Copy `default.conf.template` to `/etc/nginx/sites-available/yourdomain.conf`.
3. Manually replace the `${VARIABLE}` placeholders in the `.conf` file with your actual values (Domain, Hosts, Ports).
4. Create a symbolic link: `ln -s /etc/nginx/sites-available/yourdomain.conf /etc/nginx/sites-enabled/`.
5. Place your SSL files in `/etc/nginx/ssl/`.
6. Test and restart Nginx: `nginx -t && systemctl restart nginx`.

### 4. Environment Variables
- `DOMAIN_NAME`: Your domain name (e.g., `openresto.com`).
- `BACKEND_HOST`: The hostname of your backend service (e.g., `localhost` or `backend`).
- `BACKEND_PORT`: The port your backend is listening on (e.g., `8080`).
- `FRONTEND_HOST`: The hostname of your frontend service (e.g., `localhost` or `frontend`).
- `FRONTEND_PORT`: The port your frontend is listening on (e.g., `8081`).
