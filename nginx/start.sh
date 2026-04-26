#!/bin/sh

# Extract an IPv4 DNS resolver from resolv.conf
# On Railway/Docker, 127.0.0.11 is the internal DNS.
# We prioritize the first nameserver in resolv.conf, fallback to 127.0.0.11
FOUND_RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)

if [ -z "$FOUND_RESOLVER" ]; then
  export RESOLVER="127.0.0.11"
else
  export RESOLVER="$FOUND_RESOLVER"
fi

echo "Using resolver: $RESOLVER"

# Set defaults for required variables if not provided
export PORT="${PORT:-80}"
export BACKEND_HOST="${BACKEND_HOST:-backend}"
export BACKEND_PORT="${BACKEND_PORT:-8080}"
export FRONTEND_HOST="${FRONTEND_HOST:-frontend}"
export FRONTEND_PORT="${FRONTEND_PORT:-8081}"

echo "Configuring Nginx to proxy:"
echo "  /api/* -> http://$BACKEND_HOST:$BACKEND_PORT"
echo "  /*     -> http://$FRONTEND_HOST:$FRONTEND_PORT"

# Substitute env vars in template
envsubst '${PORT} ${BACKEND_HOST} ${BACKEND_PORT} ${FRONTEND_HOST} ${FRONTEND_PORT} ${RESOLVER}' \
  < /tmp/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "Starting Nginx on port $PORT..."
exec nginx -g 'daemon off;'
