#!/usr/bin/env bash
#
# seed-local.sh — seed the LOCAL DEV database with a Paddy's Pub dataset.
#
# Run inside WSL (or anywhere with the `sqlite3` CLI + GNU `date`). Finds
# openresto.db automatically, wipes the config + bookings tables, and re-inserts:
#
#   * brand, 3 restaurants, sections, tables, highlights  (config-snapshot.sql parity)
#   * a spread of bookings: ±14 days, lunch & dinner, ~10% cancelled
#
# AdminCredentials are wiped (NOT re-seeded) — the API bootstraps them from
# appsettings.Development.json on first login, so you just log in with the
# email/password defined there. No password hashing needed in this script.
#
# All DateTime values are stored as UTC (project convention). Restaurant-local
# times are converted to UTC with `TZ=<zone> date -u`.
#
# Usage:
#   bash scripts/seed-local.sh
#   bash scripts/seed-local.sh --db /path/to/openresto.db
#   bash scripts/seed-local.sh --no-bookings       # config only
#   bash scripts/seed-local.sh --dry-run           # print plan, touch nothing
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LOG_TAG="seed-local"
log() { printf '%s [%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$LOG_TAG" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# ── Args ─────────────────────────────────────────────────────────────────────
DB_ARG=""
NO_BOOKINGS=0
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db)          DB_ARG="${2:-}"; shift 2 ;;
    --no-bookings) NO_BOOKINGS=1; shift ;;
    --dry-run)     DRY_RUN=1; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown arg: $1 (try --help)" ;;
  esac
done

# ── Tooling checks ───────────────────────────────────────────────────────────
command -v sqlite3 >/dev/null 2>&1 || die "sqlite3 CLI not found. Run this in WSL (sudo apt install sqlite3) or put sqlite3 on PATH."
command -v date    >/dev/null 2>&1 || die "GNU date not found (need coreutils)."

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
  # Last resort: walk the tree (skip noise).
  local found
  found="$(find "$REPO_ROOT" -name 'openresto*.db' \
            -not -path '*/node_modules/*' -not -path '*/.git/*' \
            -not -path '*/data/*' 2>/dev/null | head -n1 || true)"
  [[ -n "$found" ]] && { printf '%s\n' "$found"; return; }
  return 1
}

DB="$(find_db)" || die "Could not find openresto.db. Pass --db PATH or set OPENRESTO_DB, or run the API once first."

# Make sure the schema exists (API auto-migrates on startup).
if [[ -z "$(sqlite3 "$DB" "SELECT name FROM sqlite_master WHERE type='table' AND name='Restaurants';" 2>/dev/null)" ]]; then
  die "Restaurants table missing in $DB — run the API once so EF migrations create the schema."
fi

log "DB:       $DB"
log "Bookings: $([[ $NO_BOOKINGS -eq 1 ]] && echo 'skipped (--no-bookings)' || echo 'yes')"
if [[ $DRY_RUN -eq 1 ]]; then log "DRY RUN — no changes will be made."; exit 0; fi

# ── Seed data (Paddy's Pub — mirrors scripts/config-snapshot.sql) ────────────
# table_id|restaurant_id|section_id|max_seats|timezone|open_days(ISO 1=Mon..7=Sun)
TABLES_META=(
  "1|1|1|4|America/Toronto|1,2,3,4,5,6"
  "2|1|1|2|America/Toronto|1,2,3,4,5,6"
  "3|1|2|4|America/Toronto|1,2,3,4,5,6"
  "4|2|3|2|America/Toronto|3,4,5,6"
  "5|2|3|2|America/Toronto|3,4,5,6"
  "6|3|4|2|America/Los_Angeles|1,2,3,4,5,6,7"
  "7|2|3|1|America/Toronto|3,4,5,6"
  "8|2|5|4|America/Toronto|3,4,5,6"
)

LUNCH=("12:00" "12:30" "13:00" "13:30" "14:00")
DINNER=("18:00" "18:30" "19:00" "19:30" "20:00" "20:30" "21:00" "21:30")

ADJ=(crispy golden smoky rustic zesty tender glazed roasted grilled braised fresh savory spiced toasted charred caramelized marinated seared buttery herbed honeyed tangy velvety hearty bold bright)
FOOD=(basil saffron truffle thyme olive pepper mango lemon ginger garlic mint parsley rosemary vanilla paprika cumin fennel tarragon cardamom coriander turmeric clove nutmeg dill sage oregano mustard cinnamon sesame lavender wasabi capers shallot)

GUESTS=(
  "Dee Reynolds|dee@paddyspub.com|"
  "Dennis Reynolds|dennis@paddyspub.com|Window seat please"
  "Charlie Kelly|charlie@paddyspub.com|No cats were harmed"
  "Mac McDonald|mac@paddyspub.com|"
  "Frank Reynolds|frank@paddyspub.com|Rum ham on the side"
  "The Waitress|waitress@paddyspub.com|"
  "Rickety Cricket|cricket@paddyspub.com|Accessibility needs"
  "The McPoyle Bros|mcpoyle@paddyspub.com|Milk only, no exceptions"
  "Gail the Snail|gail@paddyspub.com|"
  "The Lawyer|lawyer@paddyspub.com|Quiet table preferred"
  "Uncle Jack|jack@paddyspub.com|Keep hands visible"
  "Artemis Dubois|artemis@paddyspub.com|Improv-friendly zone"
)

declare -A used_refs used_slots

# ISO weekday (1=Mon..7=Sun, from `date +%u`) included in the comma-list `days`?
is_open() {
  local iso="$1" days="$2"
  [[ ",$days," == *",$iso,"* ]]
}

make_ref() {
  local r
  while :; do
    r="${ADJ[$((RANDOM % ${#ADJ[@]}))]}-${FOOD[$((RANDOM % ${#FOOD[@]}))]}-${FOOD[$((RANDOM % ${#FOOD[@]}))]}"
    if [[ -z "${used_refs[$r]:-}" ]]; then
      used_refs[$r]=1
      printf '%s\n' "$r"
      return
    fi
  done
}

# ── Build SQL to a temp file ─────────────────────────────────────────────────
SQL_FILE="$(mktemp -t seed-local.XXXXXX.sql)"
trap 'rm -f "$SQL_FILE"' EXIT

# All SQL is written to fd 3 so log() (stderr) never pollutes it.
exec 3>"$SQL_FILE"

{
  echo "PRAGMA foreign_keys=OFF;"
  echo "PRAGMA busy_timeout=5000;"
  echo "BEGIN;"

  echo "-- Wipe config + bookings + admin creds (API re-bootstraps admin on first login)"
  echo "DELETE FROM AdminNotifications;"
  echo "DELETE FROM EmailFailures;"
  echo "DELETE FROM Bookings;"
  echo "DELETE FROM Highlights;"
  echo "DELETE FROM SocialLinks;"
  echo "DELETE FROM Tables;"
  echo "DELETE FROM Sections;"
  echo "DELETE FROM Restaurants;"
  echo "DELETE FROM BrandSettings;"
  echo "DELETE FROM EmailSettings;"
  echo "DELETE FROM AdminCredentials;"
  echo "DELETE FROM sqlite_sequence WHERE name IN ('Bookings','Highlights','SocialLinks','Tables','Sections','Restaurants','BrandSettings','EmailSettings','AdminCredentials','AdminNotifications','EmailFailures');"

  # Brand (EmailSettings intentionally left empty — no SMTP creds in source control)
  # HeaderImageFit left NULL → defaults to Cover (today's behaviour).
  echo "INSERT INTO BrandSettings(AppName,PrimaryColor,AccentColor,FaviconIcon,HeaderImageUrl,WebsiteUrl,CopyrightText,Subtitle,HighlightsHeading,HighlightsSubheading) VALUES('Paddy''s Pub','#059669',NULL,'pizza','/media/hero.jpg','https://openres.to',NULL,'Philadelphia''s home of milk steak and jelly beans.','What we''re known for','Curated by Frank Reynolds');"

  # Restaurants (WalkInOnly=0 / WalkInDays=NULL keeps online bookings enabled everywhere)
  # Description supports [label](url) inline links — see app/(user)/restaurant/[id].tsx.
  # MenuUrl is nullable; restaurant 2 is left NULL to demo the "no menu link" state.
  echo "INSERT INTO Restaurants(Id,Name,Address,OpenTime,CloseTime,OpenDays,Timezone,BookingsPausedUntil,Tags,ImageUrl,IsArchived,WalkInOnly,WalkInDays,Description,MenuUrl) VALUES(1,'Paddy''s Pub','346 W Girard Ave, Philadelphia, PA','09:00','23:45','1,2,3,4,5,6','America/Toronto',NULL,'mac and cheese,fight milk','/media/location-1.jpg',0,0,NULL,'Philadelphia''s worst bar, now taking bookings. See our [menu](https://paddyspub.example/menu) — cash only.','https://paddyspub.example/menu');"
  echo "INSERT INTO Restaurants(Id,Name,Address,OpenTime,CloseTime,OpenDays,Timezone,BookingsPausedUntil,Tags,ImageUrl,IsArchived,WalkInOnly,WalkInDays,Description,MenuUrl) VALUES(2,'Paddy''s Pub Toronto','The Alley Behind the Alley, Toronto, ON','09:00','23:45','3,4,5,6','America/Toronto',NULL,'charlie work,mantis toboggan','/media/location-2.webp',0,0,NULL,'The Alley Behind the Alley. Walk-ins welcome, online bookings for the brave.',NULL);"
  echo "INSERT INTO Restaurants(Id,Name,Address,OpenTime,CloseTime,OpenDays,Timezone,BookingsPausedUntil,Tags,ImageUrl,IsArchived,WalkInOnly,WalkInDays,Description,MenuUrl) VALUES(3,'Paddy''s Pub (Vancouver)','Multiple Areas, please don''t ask','00:00','23:00','1,2,3,4,5,6,7','America/Los_Angeles',NULL,'wolf cola,dennis system','/media/location-3.jpg',0,0,NULL,'Open 24 hours because we lost the keys to the lock. [Reviews](https://paddyspub.example/reviews).','https://paddyspub.example/vancouver-menu.pdf');"

  # Sections (SortOrder is explicit per-restaurant display order, not insertion order)
  echo "INSERT INTO Sections(Id,Name,RestaurantId,SortOrder) VALUES(1,'Indoor',1,0);"
  echo "INSERT INTO Sections(Id,Name,RestaurantId,SortOrder) VALUES(2,'Patio',1,1);"
  echo "INSERT INTO Sections(Id,Name,RestaurantId,SortOrder) VALUES(3,'Bar',2,0);"
  echo "INSERT INTO Sections(Id,Name,RestaurantId,SortOrder) VALUES(4,'The Bar',3,0);"
  echo "INSERT INTO Sections(Id,Name,RestaurantId,SortOrder) VALUES(5,'Tables',2,1);"

  # Tables
  echo "INSERT INTO Tables(Id,Name,Seats,SectionId) VALUES(1,'T1',4,1);"
  echo "INSERT INTO Tables(Id,Name,Seats,SectionId) VALUES(2,'T2',2,1);"
  echo "INSERT INTO Tables(Id,Name,Seats,SectionId) VALUES(3,'P1',4,2);"
  echo "INSERT INTO Tables(Id,Name,Seats,SectionId) VALUES(4,'B1',2,3);"
  echo "INSERT INTO Tables(Id,Name,Seats,SectionId) VALUES(5,'B2',2,3);"
  echo "INSERT INTO Tables(Id,Name,Seats,SectionId) VALUES(6,'Bar Table',2,4);"
  echo "INSERT INTO Tables(Id,Name,Seats,SectionId) VALUES(7,'B3',1,3);"
  echo "INSERT INTO Tables(Id,Name,Seats,SectionId) VALUES(8,'Table 1',4,5);"

  # Highlights (Link=NULL → static card; set a Link to make the whole card clickable)
  echo "INSERT INTO Highlights(Id,Title,Body,IconKey,SortOrder,Link) VALUES(1,'Dayman Live Every Friday','Fighter of the Nightman. No cover charge. Cash only. Residency secured after a lengthy legal dispute.','star-outline',0,'https://paddyspub.example/dayman');"
  echo "INSERT INTO Highlights(Id,Title,Body,IconKey,SortOrder,Link) VALUES(2,'Frank''s Famous Rum Ham','A Reynolds family tradition since 1981. Seasonal availability. Do not ask about the ingredients. Do not ask where Frank has been.','pizza-outline',1,NULL);"
  echo "INSERT INTO Highlights(Id,Title,Body,IconKey,SortOrder,Link) VALUES(3,'Chardee MacDennis','The Game of Games. Teams of 2. Bring your own wine glass to smash. Management not responsible for emotional damage.','gift-outline',2,NULL);"
  echo "INSERT INTO Highlights(Id,Title,Body,IconKey,SortOrder,Link) VALUES(4,'Milk Steak - Our Signature Dish','Boiled over hard, served with a side of your finest jelly beans. Charlie''s personal recipe. Our most polarising menu item. Loved by ghouls.','nutrition-outline',3,'https://paddyspub.example/menu');"

  # Social Links (footer)
  echo "INSERT INTO SocialLinks(Id,Label,Url,IconKey,SortOrder) VALUES(1,'Instagram','https://instagram.com/paddyspub','logo-instagram',0);"
  echo "INSERT INTO SocialLinks(Id,Label,Url,IconKey,SortOrder) VALUES(2,'Yelp','https://yelp.com/biz/paddys-pub','star-outline',1);"
} >&3

# ── Generate bookings (±14 days, lunch + dinner, ~10% cancelled) ─────────────
booking_count=0
if [[ $NO_BOOKINGS -eq 0 ]]; then
  log "Generating bookings (±14 days)…"
  guest_idx=0
  num_guests=${#GUESTS[@]}
  seats_pool=(1 2 2 4 4)
  TODAY="$(date -u '+%Y-%m-%d')"

  for day_offset in $(seq -14 14); do
    LOCAL_DATE="$(date -u -d "$TODAY $day_offset days" '+%Y-%m-%d')"
    ISO_DAY="$(date -d "$LOCAL_DATE" '+%u')"
    if [[ $day_offset -lt 0 ]]; then CANCEL_RATE=15; else CANCEL_RATE=5; fi

    for meta in "${TABLES_META[@]}"; do
      IFS='|' read -r tbl_id resto_id sec_id max_seats tz open_days <<< "$meta"
      is_open "$ISO_DAY" "$open_days" || continue

      # 1 random lunch slot + 3 random dinner slots (deduped via used_slots).
      times=("${LUNCH[$((RANDOM % ${#LUNCH[@]}))]}")
      for _ in 1 2 3; do
        times+=("${DINNER[$((RANDOM % ${#DINNER[@]}))]}")
      done

      for t in "${times[@]}"; do
        slot_key="${tbl_id}|${LOCAL_DATE}|${t}"
        [[ -n "${used_slots[$slot_key]:-}" ]] && continue
        used_slots[$slot_key]=1

        # Guest (round-robin).
        IFS='|' read -r gname gemail gspecial <<< "${GUESTS[$((guest_idx % num_guests))]}"
        guest_idx=$((guest_idx + 1))
        [[ -n "$gspecial" ]] && gspecial_sql="'$gspecial'" || gspecial_sql="NULL"
        [[ -n "$gemail"   ]] && gemail_sql="'$gemail'"     || gemail_sql="NULL"

        # Seats: pick from pool, capped by the table's max.
        want=${seats_pool[$((RANDOM % 5))]}
        if (( want > max_seats )); then want=$max_seats; fi

        ref="$(make_ref)"

        # Restaurant-local time → UTC (project stores everything as UTC).
        utc_dt="$(TZ="$tz" date -u -d "$LOCAL_DATE $t:00" '+%Y-%m-%d %H:%M:%S')"

        # ~CANCEL_RATE% cancellation; cancelled_at is 0-48h ago (always in the past).
        if (( RANDOM % 100 < CANCEL_RATE )); then
          is_cancelled=1
          cancelled_at="'$(date -u -d "$((RANDOM % 48)) hours ago" '+%Y-%m-%d %H:%M:%S')'"
        else
          is_cancelled=0
          cancelled_at="NULL"
        fi

        echo "INSERT INTO Bookings(BookingRef,CustomerName,CustomerEmail,Date,Seats,SectionId,TableId,RestaurantId,IsCancelled,CancelledAt,SpecialRequests) VALUES('$ref','$gname',$gemail_sql,'$utc_dt',$want,$sec_id,$tbl_id,$resto_id,$is_cancelled,$cancelled_at,$gspecial_sql);" >&3
        booking_count=$((booking_count + 1))
      done
    done
  done
fi

echo "COMMIT;" >&3
echo "PRAGMA foreign_keys=ON;" >&3
exec 3>&-

# ── Apply ────────────────────────────────────────────────────────────────────
log "Applying seed (~$booking_count bookings)…"
sqlite3 "$DB" < "$SQL_FILE"

# ── Summary ──────────────────────────────────────────────────────────────────
log "Done. Row counts:"
for t in Restaurants Sections Tables Highlights SocialLinks BrandSettings Bookings AdminCredentials; do
  log "  $t: $(sqlite3 "$DB" "SELECT COUNT(*) FROM $t;")"
done
log "Seeded $booking_count bookings."
