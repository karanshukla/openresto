#!/usr/bin/env bash
#
# seed-local.sh — seed the LOCAL DEV database with the Paddy's Pub demo dataset.
#
# The dataset itself lives in scripts/demo_data.py (the single source of truth,
# shared with purge-bookings.sh). This script only locates the database and
# applies what the generator emits.
#
# AdminCredentials are wiped but NOT re-seeded — the API bootstraps the Owner
# account from appsettings.Development.json at startup, so restart the backend
# after a reseed and log in with the email/password defined there. No password
# hashing needed here. (Login itself no longer creates accounts: it looks them
# up, so a wiped database with a running server has nothing to log in to until
# that restart.)
#
# Usage:
#   bash scripts/seed-local.sh
#   bash scripts/seed-local.sh --db /path/to/openresto.db
#   bash scripts/seed-local.sh --config-only        # no bookings
#   bash scripts/seed-local.sh --bookings-only      # leave config alone
#   bash scripts/seed-local.sh --seed 42            # reproducible dataset
#   bash scripts/seed-local.sh --keep-admin         # don't wipe AdminCredentials
#   bash scripts/seed-local.sh --media-dir DIR      # where to look for artwork
#   bash scripts/seed-local.sh --dry-run            # print the SQL, touch nothing
#
# Location images, the hero image and menu PDFs are linked from the files that
# actually exist in the media directory (default OpenRestoApi/wwwroot/media),
# so anything uploaded through the admin UI survives a reseed.
#
# Any other flags are forwarded to demo_data.py, e.g.:
#   bash scripts/seed-local.sh --days-forward 30 --occupancy 0.8
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GENERATOR="$SCRIPT_DIR/demo_data.py"

LOG_TAG="seed-local"
log() { printf '%s [%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$LOG_TAG" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# ── Args ─────────────────────────────────────────────────────────────────────
DB_ARG=""
SECTION="all"
DRY_RUN=0
KEEP_ADMIN=0
MEDIA_DIR="$REPO_ROOT/OpenRestoApi/wwwroot/media"
GEN_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db)            DB_ARG="${2:-}"; shift 2 ;;
    --config-only)   SECTION="config"; shift ;;
    --bookings-only) SECTION="bookings"; shift ;;
    --media-dir)     MEDIA_DIR="${2:-}"; shift 2 ;;
    --keep-admin)    KEEP_ADMIN=1; shift ;;
    --dry-run)       DRY_RUN=1; shift ;;
    -h|--help)       grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)               GEN_ARGS+=("$1"); shift ;;
  esac
done

# ── Tooling ──────────────────────────────────────────────────────────────────
command -v python3 >/dev/null 2>&1 || die "python3 not found (needed to generate the dataset)."
[[ -f "$GENERATOR" ]] || die "generator not found at $GENERATOR"

# sqlite3 is optional: fall back to Python's bundled sqlite3 module.
apply_sql() {
  local db="$1"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$db"
  else
    python3 -c '
import sqlite3, sys
db = sys.argv[1]
con = sqlite3.connect(db)
con.executescript(sys.stdin.read())
con.commit()
con.close()
' "$db"
  fi
}

query() {
  local db="$1" sql="$2"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$db" "$sql"
  else
    python3 -c '
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
print(con.execute(sys.argv[2]).fetchone()[0])
' "$db" "$sql"
  fi
}

# ── Find the DB ──────────────────────────────────────────────────────────────
find_db() {
  if [[ -n "$DB_ARG" ]]; then
    [[ -f "$DB_ARG" ]] || die "--db path does not exist: $DB_ARG"
    printf '%s\n' "$DB_ARG"; return
  fi
  if [[ -n "${OPENRESTO_DB:-}" && -f "$OPENRESTO_DB" ]]; then
    printf '%s\n' "$OPENRESTO_DB"; return
  fi
  local c
  for c in \
      "$REPO_ROOT/OpenRestoApi/openresto.db" \
      "$REPO_ROOT/openresto.db" \
      "$REPO_ROOT/OpenRestoApi/bin/Debug/net10.0/openresto.db"; do
    if [[ -f "$c" ]]; then printf '%s\n' "$c"; return; fi
  done
  local found
  found="$(find "$REPO_ROOT" -name 'openresto*.db' \
            -not -path '*/node_modules/*' -not -path '*/.git/*' \
            -not -path '*/data/*' 2>/dev/null | head -n1 || true)"
  [[ -n "$found" ]] && { printf '%s\n' "$found"; return; }
  return 1
}

# ── Generate ─────────────────────────────────────────────────────────────────
SQL_FILE="$(mktemp -t seed-local.XXXXXX.sql)"
trap 'rm -f "$SQL_FILE"' EXIT

# Location images and the hero are linked from whatever is actually in the
# media directory, so an image uploaded through the admin UI survives a reseed.
MEDIA_ARGS=()
if [[ "$SECTION" != "bookings" && -d "$MEDIA_DIR" ]]; then
  MEDIA_ARGS=(--media-dir "$MEDIA_DIR")
fi

python3 "$GENERATOR" "$SECTION" "${MEDIA_ARGS[@]+"${MEDIA_ARGS[@]}"}" "${GEN_ARGS[@]+"${GEN_ARGS[@]}"}" > "$SQL_FILE"

# The API re-bootstraps the Owner account from appsettings at startup, so wiping
# these keeps a reseeded database in sync with the configured login — restart the
# backend afterwards, since only startup creates the account.
if [[ $KEEP_ADMIN -eq 0 && "$SECTION" != "bookings" ]]; then
  {
    echo "DELETE FROM AdminCredentials;"
    echo "DELETE FROM sqlite_sequence WHERE name = 'AdminCredentials';"
  } >> "$SQL_FILE"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  log "DRY RUN — emitting SQL to stdout, database untouched."
  cat "$SQL_FILE"
  exit 0
fi

DB="$(find_db)" || die "Could not find openresto.db. Pass --db PATH or set OPENRESTO_DB, or run the API once first."

if [[ -z "$(query "$DB" "SELECT name FROM sqlite_master WHERE type='table' AND name='Restaurants';")" ]]; then
  die "Restaurants table missing in $DB — run the API once so EF migrations create the schema."
fi

log "DB:      $DB"
log "Section: $SECTION"

apply_sql "$DB" < "$SQL_FILE"

# ── Summary ──────────────────────────────────────────────────────────────────
log "Done. Row counts:"
for t in Restaurants Sections Tables TableGroups Highlights SocialLinks BrandSettings Bookings AdminNotifications AdminCredentials; do
  log "  $t: $(query "$DB" "SELECT COUNT(*) FROM $t;")"
done
