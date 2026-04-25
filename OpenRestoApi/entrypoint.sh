#!/bin/bash

set -e



# Fix permissions for the /data directory (where the volume is mounted)

echo "Fixing permissions for /data..."

mkdir -p /data

chown -R app:app /data

chmod 775 /data



# Execute the application as the 'app' user

echo "Starting application as 'app' user..."

exec gosu app dotnet OpenRestoApi.dll