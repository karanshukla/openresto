#!/usr/bin/env bash
# Deletes all bookings and customer PII, then resets admin credentials from .env.
# Safe to run against a live container — preserves all restaurant config.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
DB="/data/openresto.db"
LOG_TAG="purge-bookings"

COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.vps.yml"
CONTAINER="$(docker compose -f "$COMPOSE_FILE" ps -q backend 2>/dev/null | head -1)"
if [[ -z "$CONTAINER" ]]; then
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') tainer not running." >&2
  exit 1
fi

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:

# Ensure sqlite3 is available in the container (survives container restarts).
if ! docker exec "$CONTAINER" sh -c 'comm1'; then
  log "sqlite3 not found in container — installing..."
  docker exec -u root "$CONTAINER" sh -c t install -y -qq sqlite3'
  log "sqlite3 installed."
fi

# --- Purge bookings and PII ---
SQL="
PRAGMA foreign_keys = OFF;
DELETE FROM AdminNotifications;
DELETE FROM EmailFailures;
DELETE FROM Bookings;
DELETE FROM sqlite_sequence WHERE name IN ('Bookings', 'AdminNotifications', 'EmailFailures');
PRAGMA foreign_keys = ON;
PRAGMA wal_checkpoint(TRUNCATE);
"

log "Purging bookings and PII..."
docker exec "$CONTAINER" sqlite3 "$DB" "$SQL"
log "Purge done. Bookings remaining: $(docker exec "$CONTAINER" sqlite3 "$DB" 'SELECT COUNT(*) FROM Bookings;')"

# --- Reset admin credentials from .env -
if [[ ! -f "$ENV_FILE" ]]; then
  log "WARNING: .env not found at $ENV_FIt."
  exit 0
fi

ADMIN_EMAIL="$(grep -E '^ADMIN_EMAIL=' "$ -d '[:space:]')"
ADMIN_PASSWORD="$(grep -E '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"

if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  log "WARNING: ADMIN_EMAIL or ADMIN_PASSng credential reset."
  exit 0
fi

# PBKDF2-SHA256, 100k iterations, 16-byteAuthController.HashPassword
read -r NEW_HASH NEW_SALT < <(python3 - "$ADMIN_PASSWORD" <<'PYEOF'
import sys, os, hashlib, base64
password = sys.argv[1].encode()
salt = os.urandom(16)
key = hashlib.pbkdf2_hmac('sha256', passw
print(base64.b64encode(key).decode(), base64.b64encode(salt).decode())
PYEOF
)

log "Resetting admin credentials for $ADMIN_EMAIL..."
docker exec "$CONTAINER" sqlite3 "$DB" \
"UPDATE AdminCredentials SET Email='$ADMIHASH', PasswordSalt='$NEW_SALT',
PvqQuestion=NULL, PvqAnswerHash=NULL, PvqULL, ResetTokenExpiry=NULL;"

log "Credential reset done."

# --- Seed example bookings ---
log "Seeding example bookings..."
SEED_SQL="$(python3 <<'PYEOF'
import random, datetime, zoneinfo

random.seed()

ADJECTIVES = [
    "crispy","golden","smoky","rustic","zesty","tender","glazed","roasted","grilled",
    "braised","fresh","savory","spiced","ed","marinated",
    "seared","buttery","herbed","honeyed","tangy","velvety","hearty","bold","bright",
]
FOODS = [
    "basil","saffron","truffle","thyme","olive","pepper","mango","lemon","ginger",
    "garlic","mint","parsley","rosemary",fennel",
    "tarragon","cardamom","coriander","turmeric","clove","nutmeg","dill","sage",
    "oregano","mustard","cinnamon","sesams","shallot",
]

def booking_ref():
    adj = random.choice(ADJECTIVES)
    foods = random.sample(FOODS, 2)
    return f"{adj}-{foods[0]}-{foods[1]}"

# (name, email, special_requests or None)
GUESTS = [
    ("Dee Reynolds",    "dee@paddyspub.com",     None),
    ("Dennis Reynolds", "dennis@paddyspub.com",  "Window seat please"),
    ("Charlie Kelly",   "charlie@paddyspu),
    ("Mac McDonald",    "mac@paddyspub.co
    ("Frank Reynolds",  "frank@paddyspub.),
    ("The Waitress",    "waitress@paddyspub.com", None),
    ("Rickety Cricket", "cricket@paddyspu"),
    ("The McPoyle Bros","mcpoyle@paddyspub.com",  "Milk only, no exceptions"),
    ("Gail the Snail",  "gail@paddyspub.c
    ("The Lawyer",      "lawyer@paddyspub.com",   "Quiet table preferred"),
    ("Uncle Jack",      "jack@paddyspub.c),
    ("Artemis Dubois",  "artemis@paddyspub.com",  "Improv-friendly zone"),
]

# restaurant_id, section_id, table_id, ma(0=Mon)
SLOTS = [
    (1, 1, 1, 4, "America/Toronto",      [0,1,2,3,4,5]),
    (1, 1, 2, 2, "America/Toronto",
    (1, 2, 3, 4, "America/Toronto",      [0,1,2,3,4,5]),
    (2, 3, 4, 2, "America/Toronto",      [2,3,4,5]),
    (2, 3, 5, 2, "America/Toronto",      [2,3,4,5]),
    (2, 3, 7, 1, "America/Toronto",
    (2, 5, 8, 4, "America/Toronto",      [2,3,4,5]),
    (3, 4, 6, 2, "America/Los_Angeles",
]

# Lunch, afternoon, and dinner service blocks
LUNCH   = ["12:00","12:30","13:00","13:30
DINNER  = ["18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30"]
TIMES   = LUNCH + DINNER

today_utc = datetime.datetime.now(datetime.timezone.utc).date()
rows = []
used_refs = set()
used_slots = set()  # (table_id, date, time)

guest_idx = 0

# Each table gets booked at multiple times per day — lunch + dinner
for day_offset in range(-14, 15):
    date = today_utc + datetime.timedelta
    day_of_week = date.weekday()

    for slot in SLOTS:
        rid, sec_id, tbl_id, max_seats, tz, open_days = slot
        if day_of_week not in open_days:
            continue

        # Book each table 2-3 times per dgs)
        times_to_book = random.sample(LUNCH, 1) + random.sample(DINNER, random.randint(2, 3))

        for time_str in times_to_book:
            if (tbl_id, str(date), time_str) in used_slots:
                continue
            used_slots.add((tbl_id, str(date), time_str))

            guest = GUESTS[guest_idx % le
            guest_idx += 1
            name, email, special = guest

            seats = min(random.choice([1,2,2,4,4]), max_seats)
            ref = booking_ref()
            while ref in used_refs:
                ref = booking_ref()
            used_refs.add(ref)

            local_tz = zoneinfo.ZoneInfo(tz)
            h, m = map(int, time_str.spli
            local_dt = datetime.datetime(date.year, date.month, date.day, h, m,

            utc_dt = local_dt.astimezone(datetime.timezone.utc)
            utc_str = utc_dt.strftime("%Y-%m-%d %H:%M:%S")

            # ~15% cancellation rate on p
            cancel_roll = random.random()
            is_cancelled = 1 if (day_offset < 0 and cancel_roll < 0.15) or (day_offset >= 0 and cancel_roll < 0.05)
else 0

            special_val   = f"'{special}'
            email_val     = f"'{email}'"   if email   else "NULL"
            name_val      = f"'{name}'"
            cancelled_col = f"'{utc_str}'" if is_cancelled else "NULL"

            rows.append(
                f"INSERT INTO Bookings(BorEmail,Date,Seats,"
                f"SectionId,TableId,RestaurantId,IsCancelled,CancelledAt,SpecialRequests) VALUES("
                f"'{ref}',{name_val},{email_val},'{utc_str}',{seats},"
                f"{sec_id},{tbl_id},{rid}l},{special_val});"
            )

print("PRAGMA foreign_keys = OFF;")
for r in rows:
    print(r)
print("PRAGMA foreign_keys = ON;")
PYEOF
)"

echo "$SEED_SQL" | docker exec -i "$CONTAINER" sqlite3 "$DB"
log "Seeding done. Bookings inserted: $(de3 "$DB" 'SELECT COUNT(*) FROM Bookings;')"

# --- Restore config snapshot ---
SNAPSHOT="$SCRIPT_DIR/config-snapshot.sql
if [[ -f "$SNAPSHOT" ]]; then
  log "Restoring config snapshot..."
  docker exec -i "$CONTAINER" sqlite3 "$D
  log "Config restored. Restaurants: $(docker exec "$CONTAINER" sqlite3 "$DB" 'SELECT COUNT(*) FROM Restaurants;')"
else
  log "WARNING: config-snapshot.sql not found — skipping config restore."
fi
