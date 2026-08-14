#!/usr/bin/env bash
# Resets the public demo deployment to a known-good state. Intended to run on a
# timer (the demo VPS runs it every 2 hours via cron).
#
# What it does, in order:
#   1. generate the demo dataset SQL on the host (before touching anything)
#   2. restore restaurant config    (brand, locations, sections, tables, groups)
#   3. reseed bookings + notifications with fresh dates relative to now
#   4. reset admin accounts (the Owner from .env, plus the demo Manager)
#   5. restore uploaded media from data/media-snapshot/
#   6. point ImageUrl/HeaderImageUrl/MenuUrl at the files that now exist
#
# ADDING ARTWORK: drop files into data/media-snapshot/ using the same names
# MediaService writes (hero.<ext>, location-<id>.<ext>, menu-<id>.pdf) and they
# appear on the next reset. Equivalently, upload through the admin UI and then
# re-snapshot so the upload becomes part of the curated set:
#
#   CONTAINER=$(docker compose -f docker-compose.vps.yml ps -q backend | head -1)
#   docker cp "$CONTAINER:/app/wwwroot/media/." data/media-snapshot/
#
# Anything NOT in the snapshot is wiped on every run. That is deliberate: the
# demo's admin credentials are public, so visitor uploads must not persist.
#
# The dataset lives in scripts/demo_data.py — the single source of truth shared
# with seed-local.sh. Edit that file, not this one, to change what gets seeded.
#
# Step 1 happens first on purpose: if the generator fails, the script aborts
# with the demo still intact rather than leaving it wiped until the next run.
#
# BEFORE THE FIRST RUN: snapshot your uploaded media so it gets restored
# afterwards. The snapshot lives in ./data/media-snapshot/ (the bind-mounted
# data directory — persists across code updates and redeploys):
#
#   mkdir -p data/media-snapshot
#   CONTAINER=$(docker compose -f docker-compose.vps.yml ps -q backend | head -1)
#   docker cp "$CONTAINER:/app/wwwroot/media/." data/media-snapshot/
#
# Usage:
#   scripts/purge-bookings.sh
#   scripts/purge-bookings.sh --compose-file docker-compose.yml
#   scripts/purge-bookings.sh --config-only      # restore config, keep bookings
#   scripts/purge-bookings.sh --skip-media       # leave uploaded media alone
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
GENERATOR="$SCRIPT_DIR/demo_data.py"
DB="/data/openresto.db"
LOG_TAG="purge-bookings"

COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.vps.yml"
SECTION="all"
SKIP_MEDIA=0
GEN_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compose-file) COMPOSE_FILE="${2:-}"; shift 2 ;;
    --config-only)  SECTION="config"; shift ;;
    --skip-media)   SKIP_MEDIA=1; shift ;;
    -h|--help)      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)              GEN_ARGS+=("$1"); shift ;;
  esac
done

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') [$LOG_TAG] $*"; }
die() { log "ERROR: $*"; exit 1; }

command -v python3 >/dev/null 2>&1 || die "python3 is required on the host."
[[ -f "$GENERATOR" ]] || die "generator not found at $GENERATOR"

# --- 1. Generate the dataset BEFORE touching the live database ---------------
SQL_FILE="$(mktemp -t demo-data.XXXXXX.sql)"
ACCOUNTS_SQL_FILE="$(mktemp -t demo-accounts.XXXXXX.sql)"
trap 'rm -f "$SQL_FILE" "$ACCOUNTS_SQL_FILE"' EXIT

log "Generating demo dataset ($SECTION)..."
python3 "$GENERATOR" "$SECTION" "${GEN_ARGS[@]+"${GEN_ARGS[@]}"}" > "$SQL_FILE" \
  || die "dataset generation failed — demo left untouched."
log "Generated $(wc -l < "$SQL_FILE") lines of SQL."

# Accounts are generated here too, for the same reason: a missing password should abort
# while the demo is still intact, not after the dataset has already been applied. The
# password reaches the generator through the environment rather than argv, where any
# local user could read it out of `ps`.
ADMIN_EMAIL=""
SEED_ACCOUNTS=0
if [[ ! -f "$ENV_FILE" ]]; then
  log "WARNING: .env not found at $ENV_FILE — skipping credential reset."
else
  ADMIN_EMAIL="$(grep -E '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || true)"
  ADMIN_PASSWORD="$(grep -E '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2- || true)"

  if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
    log "WARNING: ADMIN_EMAIL or ADMIN_PASSWORD missing in .env — skipping credential reset."
  else
    ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
      python3 "$GENERATOR" accounts > "$ACCOUNTS_SQL_FILE" \
      || die "account generation failed — demo left untouched."
    SEED_ACCOUNTS=1
    # Derived from what was actually generated, so adding an account to the dataset
    # doesn't silently leave this assertion checking the old number.
    EXPECTED_ACCOUNTS="$(grep -c '^INSERT INTO AdminCredentials' "$ACCOUNTS_SQL_FILE")"
    unset ADMIN_PASSWORD
  fi
fi

CONTAINER="$(docker compose -f "$COMPOSE_FILE" ps -q backend 2>/dev/null | head -1)"
[[ -n "$CONTAINER" ]] || die "backend container not running (compose file: $COMPOSE_FILE)."

# Ensure sqlite3 is available in the container (survives container restarts).
if ! docker exec "$CONTAINER" sh -c 'command -v sqlite3 >/dev/null 2>&1'; then
  log "sqlite3 not found in container — installing..."
  docker exec -u root "$CONTAINER" sh -c 'apt-get update -qq && apt-get install -y -qq sqlite3'
  log "sqlite3 installed."
fi

# --- 2 & 3. Apply config + bookings ------------------------------------------
# One transaction, config before bookings so the FKs bookings depend on exist.
log "Applying dataset..."
docker exec -i "$CONTAINER" sqlite3 "$DB" < "$SQL_FILE"
docker exec "$CONTAINER" sqlite3 "$DB" 'PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null

count() { docker exec "$CONTAINER" sqlite3 "$DB" "SELECT COUNT(*) FROM $1;"; }
log "Applied. Locations: $(count Restaurants), tables: $(count Tables), bookings: $(count Bookings), notifications: $(count AdminNotifications)"

# --- 4. Reset admin accounts -------------------------------------------------
# The demo's admin password is public, so a visitor can invite themselves a colleague.
# The generator's accounts section wipes every row and puts back only the curated pair,
# for the same reason visitor uploads don't survive a reset.
if [[ $SEED_ACCOUNTS -eq 1 ]]; then
  log "Resetting admin accounts (Owner $ADMIN_EMAIL + demo Manager)..."
  docker exec -i "$CONTAINER" sqlite3 "$DB" < "$ACCOUNTS_SQL_FILE"

  OWNERS="$(docker exec "$CONTAINER" sqlite3 "$DB" \
    "SELECT COUNT(*) FROM AdminCredentials WHERE Role='Owner' AND IsActive=1 AND lower(Email)=lower('${ADMIN_EMAIL//\'/\'\'}');")"
  [[ "$OWNERS" == "1" ]] \
    || die "expected exactly one active Owner named '$ADMIN_EMAIL' after reset, found $OWNERS."
  ACCOUNT_COUNT="$(docker exec "$CONTAINER" sqlite3 "$DB" 'SELECT COUNT(*) FROM AdminCredentials;')"
  [[ "$ACCOUNT_COUNT" == "$EXPECTED_ACCOUNTS" ]] \
    || die "expected $EXPECTED_ACCOUNTS admin accounts after reset, found $ACCOUNT_COUNT."
  log "Account reset done ($ACCOUNT_COUNT accounts)."
fi

# --- 5. Restore media --------------------------------------------------------
# data/media-snapshot/ is the curated demo artwork and the source of truth.
# Purge-then-restore so images uploaded by demo visitors don't accumulate: the
# whole point of the reset is to undo whatever visitors did, and admin
# credentials are public on a demo site.
MEDIA_SNAPSHOT="$SCRIPT_DIR/../data/media-snapshot"
MEDIA_RESTORED=0
if [[ $SKIP_MEDIA -eq 1 ]]; then
  log "Skipping media restore (--skip-media)."
elif [[ -d "$MEDIA_SNAPSHOT" ]]; then
  log "Purging uploaded media..."
  docker exec "$CONTAINER" sh -c 'find /app/wwwroot/media -maxdepth 1 -type f -delete'
  log "Restoring media snapshot..."
  FILE_COUNT=0
  for f in "$MEDIA_SNAPSHOT"/*; do
    [[ -f "$f" ]] || continue
    docker cp "$f" "$CONTAINER:/app/wwwroot/media/"
    FILE_COUNT=$((FILE_COUNT + 1))
  done
  MEDIA_RESTORED=1
  log "Media restored. Files copied: $FILE_COUNT"
else
  # No snapshot means a purge would leave the demo with broken images and no
  # way back, so leave the uploaded media in place.
  log "WARNING: media-snapshot/ not found at $MEDIA_SNAPSHOT — leaving uploaded media untouched."
fi

# --- 6. Point the database at the artwork that now exists --------------------
# The config step deliberately leaves ImageUrl/HeaderImageUrl NULL, so this is
# what makes images show up at all. Deriving them from disk (rather than
# hardcoding paths) means a file added to the snapshot appears on the next
# reset with no code change, whatever extension it has.
if [[ $MEDIA_RESTORED -eq 1 ]]; then
  log "Linking media..."
  MEDIA_SQL="$(python3 "$GENERATOR" media --media-dir "$MEDIA_SNAPSHOT" 2>/dev/null)" \
    || die "media linking failed (config and bookings are already applied)."
  printf '%s\n' "$MEDIA_SQL" | docker exec -i "$CONTAINER" sqlite3 "$DB"
  LINKED="$(docker exec "$CONTAINER" sqlite3 "$DB" \
    'SELECT COUNT(*) FROM Restaurants WHERE ImageUrl IS NOT NULL;')"
  log "Linked. Locations with an image: $LINKED"
fi

log "Demo reset complete."
