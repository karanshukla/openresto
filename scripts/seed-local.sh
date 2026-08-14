#!/usr/bin/env bash
#
# seed-local.sh — seed the LOCAL DEV database with the Paddy's Pub demo dataset.
#
# The dataset itself lives in scripts/demo_data.py (the single source of truth,
# shared with purge-bookings.sh). This script only locates the database and
# applies what the generator emits.
#
# AdminCredentials are wiped and the single Owner account is re-seeded from the
# same Admin:Email/Admin:Password the API bootstraps from, so a reseed leaves you
# logged-in-able immediately and any extra users invited through the UI are gone.
# It has to be re-seeded here rather than left to the API: login stopped creating
# accounts when multi-user landed, and only startup bootstraps one — a wiped table
# under a running dev server would otherwise have nothing to log in to.
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

# Wipe every account (including anyone invited through the Users card) and put back
# exactly the Owner the API would have bootstrapped, so the configured login works
# without restarting the backend. PBKDF2-SHA256, 100k iterations, 16-byte salt,
# 32-byte key — matches PasswordService; CreatedAt matches demo_data.py's UTC format.
if [[ $KEEP_ADMIN -eq 0 && "$SECTION" != "bookings" ]]; then
  ADMIN_SQL="$(python3 - "$REPO_ROOT/OpenRestoApi/appsettings.Development.json" <<'PYEOF'
import base64, datetime, hashlib, json, os, pathlib, sys

settings = {}
path = pathlib.Path(sys.argv[1])
if path.is_file():
    settings = json.loads(path.read_text(encoding="utf-8")).get("Admin", {}) or {}

email = settings.get("Email") or os.environ.get("ADMIN_EMAIL") or "admin@openresto.com"
password = settings.get("Password") or os.environ.get("ADMIN_PASSWORD")
if not password:
    # No configured password to hash — emit nothing and let the caller warn.
    sys.exit(0)

salt = os.urandom(16)
key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000, dklen=32)
created = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

def q(v):
    return "'" + str(v).replace("'", "''") + "'"

print(
    "INSERT INTO AdminCredentials"
    "(Email,PasswordHash,PasswordSalt,DisplayName,Role,IsActive,CreatedAt) VALUES("
    + ",".join(
        [
            q(email.strip().lower()),
            q(base64.b64encode(key).decode()),
            q(base64.b64encode(salt).decode()),
            "NULL",
            q("Owner"),
            "1",
            q(created),
        ]
    )
    + ");"
)
PYEOF
  )"

  {
    echo "DELETE FROM AdminCredentials;"
    echo "DELETE FROM sqlite_sequence WHERE name = 'AdminCredentials';"
    if [[ -n "$ADMIN_SQL" ]]; then
      echo "$ADMIN_SQL"
    fi
  } >> "$SQL_FILE"

  [[ -n "$ADMIN_SQL" ]] || log "WARNING: no Admin:Password configured — accounts wiped without a replacement. Restart the backend with ADMIN_PASSWORD set to bootstrap one."
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
