#!/bin/sh

# Fail on any error
set -e

# 1. Extract nameservers for Nginx resolver
RESOLVERS=$(awk '/^nameserver/ {if ($2 ~ /:/) print "["$2"]"; else print $2}' /etc/resolv.conf | xargs echo)
export RESOLVER="$RESOLVERS 127.0.0.11"

echo "Using resolver: $RESOLVER"

# 2. Set defaults for required variables
export DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
export BACKEND_HOST="${BACKEND_HOST:-backend}"
export BACKEND_PORT="${BACKEND_PORT:-8080}"
export FRONTEND_HOST="${FRONTEND_HOST:-frontend}"
export FRONTEND_PORT="${FRONTEND_PORT:-8081}"

echo "Configuring Nginx for $DOMAIN_NAME..."
echo "  Proxying /api/* -> http://$BACKEND_HOST:$BACKEND_PORT"
echo "  Proxying /*      -> http://$FRONTEND_HOST:$FRONTEND_PORT"

# 3. Substitute env vars in template
envsubst '${DOMAIN_NAME} ${BACKEND_HOST} ${BACKEND_PORT} ${FRONTEND_HOST} ${FRONTEND_PORT} ${RESOLVER}' \
  < /tmp/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# 4. Validate Nginx configuration
echo "Validating Nginx configuration..."
nginx -t

# 5. Start Nginx
echo "Starting Nginx..."
exec nginx -g 'daemon off;'
