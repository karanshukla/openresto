# Nginx VPS Configuration with PositiveSSL

This directory contains a specialized Nginx configuration designed for Namecheap VPS hosting using PositiveSSL (including automatic setups on Ubuntu).

## Features
- HTTP (Port 80) to HTTPS (Port 443) redirect.
- SSL/TLS configuration optimized for PositiveSSL.
- Security headers included (OWASP best practices).
- Reverse proxy for Backend (API) and Frontend.
- Dynamic configuration via environment variables.

## SSL Certificate Preparation

### Option A: Manual PositiveSSL (Standard)
If you purchased a PositiveSSL certificate and have the `.crt` and `.ca-bundle` files:

1. Concatenate them into a single file:
   ```bash
   cat your_domain.crt your_domain.ca-bundle > server.crt
   ```
2. Use your private key as `server.key`.

### Option B: Automatic Setup (Ubuntu/Debian)
If your Namecheap VPS has Ubuntu and the SSL was set up automatically (e.g., via a plugin or standard system tools), certificates are typically found at:

- **Certificate Path:** `/etc/ssl/certs/yourdomain_com.crt` (or similar combined file)
- **Private Key Path:** `/etc/ssl/private/yourdomain_com.key`

You can mount these directly into the Docker container or copy them to your project's `ssl/` directory.

## Deployment

### 1. Place SSL Files
Ensure your SSL files are available on your VPS. By default, the configuration looks for:
- `/etc/nginx/ssl/server.crt`
- `/etc/nginx/ssl/server.key`

### 2. Run with Docker Compose
You can customize the SSL paths using environment variables `SSL_CERT_PATH` and `SSL_KEY_PATH`.

```yaml
services:
  reverse-proxy:
    build: ./nginx-vps
    ports:
      - "80:80"
      - "443:443"
    environment:
      - DOMAIN_NAME=yourdomain.com
      - BACKEND_HOST=backend
      - BACKEND_PORT=8080
      - FRONTEND_HOST=frontend
      - FRONTEND_PORT=8081
      # Optional: Override SSL paths inside the container
      # - SSL_CERT_PATH=/etc/nginx/ssl/custom.crt
      # - SSL_KEY_PATH=/etc/nginx/ssl/custom.key
    volumes:
      # Mount from VPS host to container
      - /etc/ssl/certs/your_combined_cert.crt:/etc/nginx/ssl/server.crt:ro
      - /etc/ssl/private/your_key.key:/etc/nginx/ssl/server.key:ro
    restart: always
```

## Environment Variables
- `DOMAIN_NAME`: Your domain name (e.g., `openresto.com`).
- `BACKEND_HOST`: The hostname of your backend service.
- `BACKEND_PORT`: The port your backend is listening on.
- `FRONTEND_HOST`: The hostname of your frontend service.
- `FRONTEND_PORT`: The port your frontend is listening on.
- `SSL_CERT_PATH`: (Optional) Path to the certificate inside the container. Defaults to `/etc/nginx/ssl/server.crt`.
- `SSL_KEY_PATH`: (Optional) Path to the private key inside the container. Defaults to `/etc/nginx/ssl/server.key`.
