---
title: HTTPS and reverse proxies
description: Terminate TLS in front of OpenResto, or use the bundled VPS nginx.
sidebar:
  order: 4
---

The release stack serves plain HTTP on `HOST_PORT`. Guests and admins should only ever reach it
over HTTPS: admin sessions use a cookie and API keys are bearer credentials. There are two ways
to get there.

## Option 1: a TLS-terminating proxy in front (recommended)

Run any proxy that terminates HTTPS and forwards to the stack's `reverse-proxy` container:
Caddy, Traefik, Nginx Proxy Manager, a host nginx, or a Cloudflare Tunnel. Point it at
`http://<host>:<HOST_PORT>`.

Make three things true:

1. **`CORS_ORIGINS` is the public HTTPS address**, e.g. `https://bookings.example.com`. Browsers
   calling the API from any other origin are refused.
2. **The proxy forwards `X-Forwarded-For` and `X-Forwarded-Proto`.** The API trusts exactly one
   hop of these headers to learn the client address and scheme, and rate limits are keyed on the
   client address. Most proxies do this by default.
3. **Large uploads pass through.** Menu PDFs can be 10 MB. If your proxy has a body-size cap,
   keep it at 12 MB or more.

A minimal Caddyfile is enough:

```txt
bookings.example.com {
    reverse_proxy localhost:80
}
```

If the proxy runs on the same host, set `HOST_PORT=8080` (or similar) in `.env` so it can own
port 80, and point `reverse_proxy` at that port.

## Option 2: the bundled VPS nginx

The repository includes `docker-compose.vps.yml`, an nginx that terminates TLS itself, redirects
HTTP to HTTPS and adds security headers. Unlike the release stack it **builds from source**, so
clone the repository on the server.

You need a domain pointing at the server, plus a certificate and private key. Let's Encrypt is
the usual choice:

```bash
certbot certonly --standalone -d bookings.example.com
```

If your CA issues a separate chain file, concatenate it onto the certificate first
(`cat your_domain.crt your_domain.ca-bundle > server.crt`).

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

Then:

```bash
docker compose -f docker-compose.vps.yml up -d
```

`CORS_ORIGINS` is derived as `https://${DOMAIN_NAME}`, so you do not set it separately. The
proxy publishes on `127.0.0.1:8080` (HTTP) and `127.0.0.1:8443` (HTTPS) only, so something on
the host, a firewall rule or a host-level proxy, has to forward public ports 80 and 443 to
those. This is deliberate: the container is never exposed to the internet directly.

Remember to reload the container after Let's Encrypt renews the certificate, since nginx reads
it at startup:

```bash
docker compose -f docker-compose.vps.yml restart reverse-proxy
```

## Check it

```bash
curl -I https://bookings.example.com/api/health
```

You should see `200`. 