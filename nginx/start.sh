#!/bin/sh
# Extract the DNS resolver from the container's resolv.conf
export RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)

# Substitute our custom env vars — leave nginx's $host, $remote_addr etc. untouched
envsubst '${PORT} ${BACKEND_HOST} ${BACKEND_PORT} ${FRONTEND_HOST} ${FRONTEND_PORT} ${RESOLVER}' \
  < /tmp/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
