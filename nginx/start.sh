#!/bin/sh

# Fail on any error
set -e

# Extract an IPv4 DNS resolver from resolv.conf
# On Railway/Docker, 127.0.0.11 is the internal DNS.
FOUND_RESOLVER=$(grep -m 1 '^nameserver' /etc/resolv.conf | awk '{print $2}')

if [ -z "$FOUND_RESOLVER" ]; then
  export RESOLVER="127.0.0.11"
else
  export RESOLVER="$FOUND_RESOLVER"
fi

echo "Using resolver: $RESOLVER"

# Set defaults for required variables if not provided by Railway
export PORT="${PORT:-80}"
export BACKEND_HOST="${BACKEND_HOST:-backend}"
export BACKEND_PORT="${BACKEND_PORT:-8080}"
export FRONTEND_HOST="${FRONTEND_HOST:-frontend}"
export FRONTEND_PORT="${FRONTEND_PORT:-8081}"

echo "Configuring Nginx on port $PORT..."
echo "  Proxying /api/* to http://$BACKEND_HOST:$BACKEND_PORT"
echo "  Proxying /* to http://$FRONTEND_HOST:$FRONTEND_PORT"

# Substitute env vars in template
envsubst '${PORT} ${BACKEND_HOST} ${BACKEND_PORT} ${FRONTEND_HOST} ${FRONTEND_PORT} ${RESOLVER}' \
  < /tmp/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Validate Nginx configuration before starting
echo "Validating Nginx configuration..."
nginx -t

echo "Starting Nginx..."
exec nginx -g 'daemon off;'
