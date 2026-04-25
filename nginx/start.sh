#!/bin/sh

# Extract an IPv4 DNS resolver from resolv.conf

export RESOLVER=$(awk '/^nameserver/{ip=$2; if(ip !~ /:/){print ip; exit}}' /etc/resolv.conf | xargs echo)



# If no local nameserver found, use a robust list of defaults

if [ -z "$RESOLVER" ]; then

  export RESOLVER="127.0.0.11 8.8.8.8 8.8.4.4"

fi



echo "Using resolver: $RESOLVER"



# Substitute our custom env vars — leave nginx's $host, $remote_addr etc. untouched

envsubst '${PORT} ${BACKEND_HOST} ${BACKEND_PORT} ${FRONTEND_HOST} ${FRONTEND_PORT} ${RESOLVER}' \

  < /tmp/default.conf.template \

  > /etc/nginx/conf.d/default.conf



exec nginx -g 'daemon off;'