#!/bin/sh
# Extract an IPv4 DNS resolver from resolv.conf (nginx can't parse bare IPv6)
export RESOLVER=$(awk '/^nameserver/{ip=$2; if(ip !~ /:/){print ip; exit}}' /etc/resolv.conf)
# Fallback: if no IPv4 found, wrap the IPv6 address in brackets for nginx
if [ -z "$RESOLVER" ]; then
  export RESOLVER=$(awk '/^nameserver/{print "[" $2 "]"; exit}' /etc/resolv.conf)
fi

# Substitute our custom env vars — leave nginx's $host, $remote_addr etc. untouched
envsubst '${PORT} ${BACKEND_HOST} ${BACKEND_PORT} ${FRONTEND_HOST} ${FRONTEND_PORT} ${RESOLVER}' \
  < /tmp/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
