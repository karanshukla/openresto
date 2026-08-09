#!/usr/bin/env bash
# Resets the admin login credentials on a running deployment — use this if
# you're locked out of /admin (forgotten password, lost security question
# answer, etc). Unlike purge-bookings.sh, this ONLY touches AdminCredentials —
# bookings, restaurant config, and media are untouched.
#
# Usage:
#   scripts/reset-admin.sh                                # reads ADMIN_EMAIL/ADMIN_PASSWORD from .env
#   scripts/reset-admin.sh --email a@b.com --password 'NewPass123'
#   scripts/reset-admin.sh --email a@b.com                # generates a random password, prints it once
#   scripts/reset-admin.sh --compose-file docker-compose.yml
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
DB="/data/openresto.db"
LOG_TAG="reset-admin"

COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.vps.yml"
NEW_EMAIL=""
NEW_PASSWORD=""
GENERATED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)        NEW_EMAIL="${2:-}"; shift 2 ;;
    --password)     NEW_PASSWORD="${2:-}"; shift 2 ;;
    --compose-file) COMPOSE_FILE="${2:-}"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1 (try --help)" >&2; exit 1 ;;
  esac
done

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') [$LOG_TAG] $*"; }

command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 is required on the host to hash the password." >&2; exit 1; }

CONTAINER="$(docker compose -f "$COMPOSE_FILE" ps -q backend 2>/dev/null | head -1)"
if [[ -z "$CONTAINER" ]]; then
  log "ERROR: backend container not running (compose file: $COMPOSE_FILE)."
  exit 1
fi

# --- Resolve email/password ---
if [[ -z "$NEW_EMAIL" && -f "$ENV_FILE" ]]; then
  NEW_EMAIL="$(grep -E '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')"
fi
if [[ -z "$NEW_PASSWORD" && -f "$ENV_FILE" ]]; then
  NEW_PASSWORD="$(grep -E '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
fi

if [[ -z "$NEW_EMAIL" ]]; then
  NEW_EMAIL="admin@openresto.com"
  log "No email supplied or found in .env — defaulting to $NEW_EMAIL"
fi

if [[ -z "$NEW_PASSWORD" ]]; then
  NEW_PASSWORD="$(python3 -c 'import secrets,string; a=string.ascii_letters+string.digits; print("".join(secrets.choice(a) for _ in range(20)))')"
  GENERATED=1
fi

if [[ ${#NEW_PASSWORD} -lt 6 ]]; then
  log "ERROR: password must be at least 6 characters."
  exit 1
fi

# Ensure sqlite3 is available in the container (survives container restarts).
if ! docker exec "$CONTAINER" sh -c 'command -v sqlite3 >/dev/null 2>&1'; then
  log "sqlite3 not found in container — installing..."
  docker exec -u root "$CONTAINER" sh -c 'apt-get update -qq && apt-get install -y -qq sqlite3'
  log "sqlite3 installed."
fi

# PBKDF2-SHA256, 100k iterations, 16-byte salt, 32-byte key — matches AuthService.HashPassword
read -r NEW_HASH NEW_SALT < <(python3 - "$NEW_PASSWORD" <<'PYEOF'
import sys, os, hashlib, base64
password = sys.argv[1].encode()
salt = os.urandom(16)
key = hashlib.pbkdf2_hmac('sha256', password, salt, 100_000, dklen=32)
print(base64.b64encode(key).decode(), base64.b64encode(salt).decode())
PYEOF
)

ESCAPED_EMAIL="${NEW_EMAIL//\'/\'\'}"

log "Resetting admin credentials for $NEW_EMAIL..."
docker exec "$CONTAINER" sqlite3 "$DB" \
  "UPDATE AdminCredentials SET Email='$ESCAPED_EMAIL', PasswordHash='$NEW_HASH', PasswordSalt='$NEW_SALT', PvqQuestion=NULL, PvqAnswerHash=NULL, PvqAnswerSalt=NULL, ResetToken=NULL, ResetTokenExpiry=NULL;"

ACTUAL_EMAIL="$(docker exec "$CONTAINER" sqlite3 "$DB" 'SELECT Email FROM AdminCredentials LIMIT 1;')"
if [[ "$ACTUAL_EMAIL" != "$NEW_EMAIL" ]]; then
  log "ERROR: AdminCredentials.Email is '$ACTUAL_EMAIL' after reset, expected '$NEW_EMAIL'."
  exit 1
fi

log "Credential reset done. Email: $NEW_EMAIL"
if [[ $GENERATED -eq 1 ]]; then
  log "Generated password (save this now, it will not be shown again): $NEW_PASSWORD"
fi
