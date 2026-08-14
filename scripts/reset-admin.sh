#!/usr/bin/env bash
# Resets the admin login credentials on a running deployment — use this if
# you're locked out of /admin (forgotten password, lost security question
# answer, etc). Unlike purge-bookings.sh, this ONLY touches AdminCredentials —
# bookings, restaurant config, and media are untouched.
#
# With multiple accounts it rewrites exactly one: the account matching --email if there is
# one, otherwise the lowest-id account (the one the first-run bootstrap created). It is
# forced back to an active Owner, so this also recovers an instance whose last Owner was
# deactivated or demoted. Other accounts are left alone.
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

# There can be several accounts now, so pick exactly one row to rewrite rather than updating
# them all (which would collide on the unique email index and clobber everyone else). The
# account with that email if it exists, otherwise the lowest-id one — the bootstrap Owner.
TARGET_ID="$(docker exec "$CONTAINER" sqlite3 "$DB" \
  "SELECT COALESCE(
     (SELECT Id FROM AdminCredentials WHERE lower(Email) = lower('$ESCAPED_EMAIL')),
     (SELECT MIN(Id) FROM AdminCredentials));")"

if [[ -z "$TARGET_ID" ]]; then
  log "ERROR: no admin accounts exist yet. Restart the backend so it bootstraps one from ADMIN_EMAIL/ADMIN_PASSWORD."
  exit 1
fi

# Also forces the account back to an active Owner: being locked out because the last Owner
# was deactivated or demoted is exactly the situation this script exists to undo.
log "Resetting admin credentials for $NEW_EMAIL (account #$TARGET_ID)..."
docker exec "$CONTAINER" sqlite3 "$DB" \
  "UPDATE AdminCredentials SET Email='$ESCAPED_EMAIL', PasswordHash='$NEW_HASH', PasswordSalt='$NEW_SALT', Role='Owner', IsActive=1, PvqQuestion=NULL, PvqAnswerHash=NULL, PvqAnswerSalt=NULL, ResetToken=NULL, ResetTokenExpiry=NULL WHERE Id=$TARGET_ID;"

ACTUAL_EMAIL="$(docker exec "$CONTAINER" sqlite3 "$DB" "SELECT Email FROM AdminCredentials WHERE Id=$TARGET_ID;")"
if [[ "$ACTUAL_EMAIL" != "$NEW_EMAIL" ]]; then
  log "ERROR: AdminCredentials.Email is '$ACTUAL_EMAIL' after reset, expected '$NEW_EMAIL'."
  exit 1
fi

log "Credential reset done. Email: $NEW_EMAIL"
if [[ $GENERATED -eq 1 ]]; then
  log "Generated password (save this now, it will not be shown again): $NEW_PASSWORD"
fi
