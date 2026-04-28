# AlmaLinux Deployment Guide (Namecheap VPS)

This guide covers specific considerations for deploying OpenResto on AlmaLinux using Docker/Podman.

## 1. SELinux Compatibility
AlmaLinux has SELinux enabled by default. This can prevent Docker containers from reading/writing to mounted volumes.

**Solution:**
In `docker-compose.vps.yml`, I have added the `:Z` flag to all volume mounts. This tells Docker to automatically relabel the files on the host so the container can access them.
- `./data:/data:Z`
- `./ssl/server.crt:/etc/nginx/ssl/server.crt:ro,Z`

## 2. Firewall Settings (firewalld)
You must explicitly open ports 80 and 443 on the host.

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 3. Using Podman (Optional)
AlmaLinux often uses Podman instead of Docker. Podman is a drop-in replacement.

If you don't have `docker-compose`, you can use `podman-compose`:
```bash
sudo dnf install podman podman-compose
podman-compose -f docker-compose.vps.yml up -d
```

## 4. SQLite Persistence
The API uses SQLite. To ensure your data is saved between restarts:
1. Create a `data` directory on your host: `mkdir data`
2. Ensure it has the correct permissions. If using Podman in rootless mode, this is usually handled automatically. If using Docker, you might need:
   `chmod 775 data && chown 1000:1000 data` (The API runs as UID 1000).

## 5. SSL Certificates
Place your concatenated `server.crt` and your `server.key` in a folder named `ssl` before running the compose file.

```bash
mkdir ssl
# Copy your files into ssl/
```

## 6. Environment Variables
Create a `.env` file in the root directory:
```env
DOMAIN_NAME=yourdomain.com
```
