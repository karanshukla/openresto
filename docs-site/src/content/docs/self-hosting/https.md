---
title: HTTPS and reverse proxies
description: Terminate TLS in front of OpenResto, or use the bundled VPS nginx.
sidebar:
  order: 4
---

The release stack serves plain HTTP on `HOST_PORT`. Because admin sign-ins and API keys travel over the connection, always expose OpenResto over HTTPS (TLS). You can terminate TLS either in an external reverse proxy or with the bundled VPS nginx setup.

## Option 1: a TLS-terminating proxy in front (recommended)

Place any HTTPS-capable reverse proxy (such as Caddy, Traefik, Nginx Proxy Manager, a host nginx, or a Cloudflare Tunnel) in front of the stack's `reverse-proxy` container, forwarding traffic to `http://<host>:<HOST_PORT>`.

Verify three requirements:

1. **Set `CORS_ORIGINS` to the public HTTPS URL** (for example, `https://bookings.example.com`). Browser API requests from any other origin are rejected.
2. **Forward `X-Forwarded-For` and `X-Forwarded-Proto`.** The backend reads one proxy hop from these headers to identify the client IP (used for rate limiting) and whether the request arrived over HTTPS. Most proxies send them by default.
3. **Allow uploads up to at least 12 MB.** Menu PDFs can be up to 10 MB; raise your proxy's body size limit if it defaults lower.

A minimal Caddyfile is sufficient:

```txt
bookings.example.com {
    reverse_proxy localhost:80
}
```

If the proxy runs on the same host, set `HOST_PORT=8080` (or another free port) in `.env` so the proxy can bind to port 80, and point `reverse_proxy` to that port.

## Option 2: the bundled VPS nginx

The repository includes `docker-compose.vps.yml`, which runs an nginx container configured for TLS termination, HTTP-to-HTTPS redirects, and security headers. Unlike the release stack, `docker-compose.vps.yml` **builds from source**, so clone the repository on the server first.

Obtain an SSL certificate and private key for your domain (for example, with Let's Encrypt):

```bash
certbot certonly --standalone -d bookings.example.com
```

If your CA provides a separate chain file, concatenate it onto the certificate first (`cat your_domain.crt your_domain.ca-bundle > server.crt`).

Create `.env` in the repository root:

```dotenv
DOMAIN_NAME=bookings.example.com
JWT_KEY=...
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=...

# Paths ON THE HOST
HOST_SSL_CERT_PATH=/etc/letsencrypt/live/bookings.example.com/fullchain.pem
HOST_SSL_KEY_PATH=/etc/letsencrypt/live/bookings.example.com/privkey.pem
```

Start the stack:

```bash
docker compose -f docker-compose.vps.yml up -d
```

`CORS_ORIGINS` is set automatically to `https://${DOMAIN_NAME}`. The container binds to `127.0.0.1:8080` (HTTP) and `127.0.0.1:8443` (HTTPS) only, keeping it off public interfaces directly; forward public ports 80 and 443 to those ports via your host firewall or proxy.

After renewing certificates with Let's Encrypt, restart nginx to reload them:

```bash
docker compose -f docker-compose.vps.yml restart reverse-proxy
```

## Verify HTTPS

```bash
curl -I https://bookings.example.com/api/health
```

A working setup returns HTTP `200`. If it fails, confirm your DNS record points to the server and ports 80 and 443 are reachable.
