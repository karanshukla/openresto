# Nginx VPS Configuration

This directory contains the Nginx configuration for production VPS deployment. It handles SSL termination, HTTP→HTTPS redirect, security headers, and reverse proxying to the backend and frontend.

## Prerequisites

- A domain pointed at your VPS (A record → server IP)
- An SSL certificate and private key for that domain
- Docker and Docker Compose installed on the VPS

## SSL Certificate

You need a certificate file and a private key. How you obtain them depends on your setup:

**Let's Encrypt (free, recommended)**

```bash
# Using certbot on the host before starting Docker
certbot certonly --standalone -d yourdomain.com
# Certificate: /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# Key:         /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

**Commercial certificate (any CA)**

If your CA gives you separate certificate and chain files, concatenate them first:

```bash
cat your_domain.crt your_domain.ca-bundle > server.crt
```

Then use `server.crt` and your `server.key`.

**Existing system certificate**

If a cert is already present on the host (e.g. `/etc/ssl/certs/`), mount it directly — no copying needed.

## Deployment

### 1. Configure environment

Create a `.env` file in the project root:

```env
DOMAIN_NAME=yourdomain.com
JWT_KEY=your-secret-key
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-admin-password

# Paths to the cert and key ON THE HOST
HOST_SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
HOST_SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### 2. Start the stack

```bash
docker compose -f docker-compose.vps.yml up -d
```

## Environment Variables

| Variable             | Description                                                                     |
| -------------------- | ------------------------------------------------------------------------------- |
| `DOMAIN_NAME`        | Your domain (e.g. `myrestaurant.com`)                                           |
| `HOST_SSL_CERT_PATH` | Path to the certificate on the host                                             |
| `HOST_SSL_KEY_PATH`  | Path to the private key on the host                                             |
| `JWT_KEY`            | Secret key for JWT signing (use a long random string)                           |
| `ADMIN_EMAIL`        | Initial admin login email                                                       |
| `ADMIN_PASSWORD`     | Initial admin login password                                                    |
| `SSL_CERT_PATH`      | _(Optional)_ Path inside the container. Defaults to `/etc/nginx/ssl/server.crt` |
| `SSL_KEY_PATH`       | _(Optional)_ Path inside the container. Defaults to `/etc/nginx/ssl/server.key` |
| `CONNECTION_STRING`  | _(Optional)_ SQLite path. Defaults to `Data Source=/data/openresto.db`          |
