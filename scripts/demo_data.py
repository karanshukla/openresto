#!/usr/bin/env python3
"""
demo_data.py — the single source of truth for OpenResto demo/seed data.

Emits SQL on stdout. Consumers pipe it straight into sqlite3:

    python3 scripts/demo_data.py config            # brand, locations, sections, tables, groups
    python3 scripts/demo_data.py bookings          # bookings + admin notifications
    python3 scripts/demo_data.py all               # both, in FK-safe order
    python3 scripts/demo_data.py accounts          # the Owner + demo Manager (see below)

The `accounts` section is not part of `all`: it needs an admin password, which it
takes from ADMIN_EMAIL/ADMIN_PASSWORD or from --settings-file, never from argv.

This file replaces three copies of the same dataset that used to drift apart
(seed-local.sh's bash heredocs, purge-bookings.sh's inline Python, and a
hand-maintained config-snapshot.sql). Edit the dataset here and every consumer
follows; scripts/config-snapshot.sql is now a generated artifact.

The dataset is deliberately built to exercise every feature the product has,
because a demo site that only shows the happy path undersells it. Each location
below is annotated with the feature it exists to surface.

Conventions this script upholds (see CLAUDE.md):
  * every DateTime is emitted as UTC, converted from restaurant-local time via
    the location's IANA timezone;
  * OpenDays / WalkInDays are comma-separated ISO day numbers (1=Mon … 7=Sun);
  * a booking reserves a table XOR a table group, never both;
  * booking references follow the location's BookingRefFormat.
"""

import argparse
import base64
import hashlib
import json
import os
import pathlib
import random
import sys
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

# ─── Admin accounts ──────────────────────────────────────────────────────────
# The instance is multi-user, so a single-account demo never shows the Users
# card doing anything. These two exist to surface that:
#
#   Owner    — the bootstrap account, email/password from configuration. No
#              DisplayName, so the UI's "display name falls back to email" path
#              is exercised alongside the Manager's, which has one.
#   Manager  — the role that sees everything except user management, so a
#              visitor can sign in as one and watch the Users card disappear.
#
# The Manager shares the Owner's password on purpose: on the public demo the
# admin password is published anyway, so "same password, different email" is
# one less thing to explain. Do not reuse this generator on an instance where
# that is not already true.

DEMO_MANAGER_EMAIL = "manager@openresto.com"
DEMO_MANAGER_DISPLAY_NAME = "Dee Reynolds"

# ─── Brand ───────────────────────────────────────────────────────────────────
# Every nullable brand field is populated: AccentColor, HeaderImageFit and
# CopyrightText were previously always NULL, so the settings UI that renders
# them had nothing to show on a seeded database.
#
# HeaderImageUrl is deliberately NOT set here — see the `media` section. Image
# URLs are derived from the files that actually exist rather than hardcoded, so
# a hardcoded path can never point at a missing file.

BRAND = {
    "AppName": "Paddy's Pub",
    "PrimaryColor": "#059669",
    "AccentColor": "#f59e0b",
    "FaviconIcon": "pizza",
    "HeaderImageUrl": None,
    "HeaderImageFit": "Cover",
    "WebsiteUrl": "https://openres.to",
    "PhoneNumber": "+1 215 555 0100",
    "EmailAddress": "bookings@paddyspub.example",
    "CopyrightText": "Paddy's Pub Inc. — established 2006, incorporated reluctantly.",
    "Subtitle": "Philadelphia's home of milk steak and jelly beans.",
    "HighlightsHeading": "What we're known for",
    "HighlightsSubheading": "Curated by Frank Reynolds",
}

# ─── Locations ───────────────────────────────────────────────────────────────
# Sections/tables/groups are nested so ids are assigned by build_dataset()
# rather than hand-numbered. `group.tables` refers to member tables by name.
#
# Between them these seven locations cover: per-day opening hours (including a
# past-midnight wrap), both booking-reference formats, all three contact
# fallback states, every slot interval (15/30/60), walk-in-only both globally
# and per-day, a live booking pause, an archived location, the table-oversize
# cap, and combinable table groups both named and unnamed.

LOCATIONS = [
    {
        # Flagship. Everything populated: both contact overrides, a menu link, a
        # description with an inline [label](url), and a named table group.
        "name": "Paddy's Pub",
        "address": "346 W Girard Ave, Philadelphia, PA",
        "timezone": "America/New_York",
        "open_days": "1,2,3,4,5,6",
        "open_time": "09:00",
        "close_time": "23:45",
        "duration": 90,
        "slot_interval": 30,
        "ref_format": 0,  # AlphaNumeric
        "tags": "mac and cheese,fight milk",
        "description": "Philadelphia's worst bar, now taking bookings. See our [menu](https://paddyspub.example/menu) — cash only.",
        "menu_url": "https://paddyspub.example/menu",
        "phone": "+1 215 555 0123",
        "email": "philly@paddyspub.example",
        "sections": [
            {"name": "Indoor", "tables": [("T1", 4), ("T2", 2), ("T3", 6), ("T4", 2)]},
            {"name": "Patio", "tables": [("P1", 4), ("P2", 4)]},
            {"name": "Snack Bar", "tables": [("S1", 2), ("S2", 2)]},
        ],
        # CombinedSeats sits in (largest member, sum of members]: pushing tables
        # together loses a cover at the shared corner. The patio pair matters for
        # the demo — at 7 seats it beats the biggest single table (T3's 6), so a
        # party of 7 is bookable *only* because the group exists, which is the
        # whole point of the feature. Above 7 the large-party notice takes over.
        "groups": [
            {"name": "Window booths", "combined_seats": 5, "tables": ["T1", "T2"]},
            {"name": "Patio run", "combined_seats": 7, "tables": ["P1", "P2"]},
        ],
    },
    {
        # Per-day opening hours (OpenHoursJson) + Numeric booking references +
        # full brand contact fallback (no phone, no email, no menu URL).
        # Fri/Sat close at 01:30 — the past-midnight wrap the hours resolver
        # handles but no seeded location previously exercised.
        "name": "Paddy's Pub Toronto",
        "address": "The Alley Behind the Alley, Toronto, ON",
        "timezone": "America/Toronto",
        "open_days": "3,4,5,6",
        "open_time": "11:00",
        "close_time": "22:00",
        "open_hours": {
            3: ("16:00", "22:00"),  # Wednesday opens late
            5: ("11:00", "01:30"),  # Friday runs past midnight
            6: ("11:00", "01:30"),  # Saturday too
        },
        "duration": 60,
        "slot_interval": 30,
        "ref_format": 1,  # Numeric
        "tags": "charlie work,mantis toboggan",
        "description": "The Alley Behind the Alley. Late kitchen Friday and Saturday.",
        "menu_url": None,
        "phone": None,
        "email": None,
        "sections": [
            {"name": "Bar", "tables": [("B1", 2), ("B2", 2), ("B3", 1)]},
            {"name": "Tables", "tables": [("Table 1", 4), ("Table 2", 4)]},
        ],
        # Unnamed group — exercises the UI's "derive a label from the members"
        # fallback path.
        "groups": [{"name": None, "combined_seats": 4, "tables": ["B1", "B2"]}],
    },
    {
        # Open 24h (OpenTime == CloseTime) + MaxTableOversizeSeats + phone-only
        # contact override, so its email still falls back to the brand default.
        "name": "Paddy's Pub (Vancouver)",
        "address": "Multiple Areas, please don't ask",
        "timezone": "America/Los_Angeles",
        "open_days": "1,2,3,4,5,6,7",
        "open_time": "00:00",
        "close_time": "00:00",
        "duration": 60,
        "slot_interval": 60,
        "ref_format": 0,
        "tags": "wolf cola,dennis system",
        "description": "Open 24 hours because we lost the keys to the lock. [Reviews](https://paddyspub.example/reviews).",
        "menu_url": "https://paddyspub.example/vancouver-menu.pdf",
        "phone": "+1 604 555 0177",
        "email": None,
        # A party may leave at most 2 seats spare, so a solo diner never gets
        # handed the 6-top.
        "max_oversize": 2,
        "sections": [
            {"name": "The Bar", "tables": [("Bar Table", 2), ("Bar Booth", 4)]},
            {"name": "Back Room", "tables": [("BR1", 6), ("BR2", 2)]},
        ],
        "groups": [],
    },
    {
        # Per-day walk-in only (WalkInDays): takes online bookings Mon–Fri, but
        # weekends are walk-in. Also the only 15-minute slot interval.
        "name": "Paddy's Pub Express",
        "address": "Terminal B, Philadelphia International",
        "timezone": "America/New_York",
        "open_days": "1,2,3,4,5,6,7",
        "open_time": "06:00",
        "close_time": "21:00",
        "walk_in_days": "6,7",
        "duration": 45,
        "slot_interval": 15,
        "ref_format": 1,
        "tags": "quick service,rum ham to go",
        "description": "Concourse location. Weekends are walk-in only — queue forms by the pretzel cart.",
        "menu_url": "https://paddyspub.example/express",
        "phone": "+1 215 555 0188",
        "email": "express@paddyspub.example",
        "sections": [
            {"name": "Counter", "tables": [("C1", 2), ("C2", 2), ("C3", 4)]},
        ],
        "groups": [],
    },
    {
        # Fully walk-in only (WalkInOnly): stays publicly listed, but the
        # booking CTA is replaced by a walk-in notice and /api/availability
        # returns no slots.
        "name": "Paddy's Pub Shore House",
        "address": "Boardwalk, Ocean City, NJ",
        "timezone": "America/New_York",
        "open_days": "4,5,6,7",
        "open_time": "12:00",
        "close_time": "23:00",
        "walk_in_only": True,
        "duration": 60,
        "slot_interval": 30,
        "ref_format": 0,
        "tags": "seasonal,sand",
        "description": "Summer only. We don't take bookings — turn up and shout your name at Frank.",
        "menu_url": None,
        "phone": None,
        "email": "shore@paddyspub.example",
        "sections": [
            {"name": "Deck", "tables": [("D1", 4), ("D2", 4), ("D3", 6)]},
        ],
        "groups": [{"name": "The long deck table", "combined_seats": 8, "tables": ["D1", "D2"]}],
    },
    {
        # Bookings actively paused (BookingsPausedUntil resolved at seed time to
        # a future instant, so the pause banner is genuinely live — the old
        # snapshot hardcoded a date that had already elapsed).
        # Longest booking duration and the 60-minute slot interval.
        "name": "Paddy's Pub Rittenhouse",
        "address": "1801 Walnut St, Philadelphia, PA",
        "timezone": "America/New_York",
        "open_days": "2,3,4,5,6",
        "open_time": "17:00",
        "close_time": "23:00",
        "paused_days": 5,  # paused until now + 5 days
        "duration": 120,
        "slot_interval": 60,
        "ref_format": 0,
        "tags": "tasting menu,white tablecloth",
        "description": "Refurbishment in progress. Bookings reopen once Charlie finishes the ceiling.",
        "menu_url": "https://paddyspub.example/rittenhouse",
        "phone": "+1 215 555 0144",
        "email": "rittenhouse@paddyspub.example",
        "sections": [
            {"name": "Dining Room", "tables": [("R1", 2), ("R2", 4), ("R3", 4)]},
        ],
        "groups": [],
    },
    {
        # Archived (IsArchived): filtered out of public and admin lists, so the
        # archive/restore admin flow has something real to act on.
        "name": "Paddy's Pub Old City",
        "address": "2nd & Market, Philadelphia, PA",
        "timezone": "America/New_York",
        "open_days": "1,2,3,4,5",
        "open_time": "11:00",
        "close_time": "22:00",
        "archived": True,
        "duration": 60,
        "slot_interval": 30,
        "ref_format": 0,
        "tags": "closed,lease dispute",
        "description": "Closed pending a lease dispute nobody wants to talk about.",
        "menu_url": None,
        "phone": None,
        "email": None,
        "sections": [
            {"name": "Main", "tables": [("M1", 4), ("M2", 2)]},
        ],
        "groups": [],
    },
]

# ─── Home page content ───────────────────────────────────────────────────────

HIGHLIGHTS = [
    (
        "Dayman Live Every Friday",
        "Fighter of the Nightman. No cover charge. Cash only. Residency secured after a lengthy legal dispute.",
        "star-outline",
        "https://paddyspub.example/dayman",
    ),
    (
        "Frank's Famous Rum Ham",
        "A Reynolds family tradition since 1981. Seasonal availability. Do not ask about the ingredients. Do not ask where Frank has been.",
        "pizza-outline",
        None,
    ),
    (
        "Chardee MacDennis",
        "The Game of Games. Teams of 2. Bring your own wine glass to smash. Management not responsible for emotional damage.",
        "gift-outline",
        None,
    ),
    (
        "Milk Steak - Our Signature Dish",
        "Boiled over hard, served with a side of your finest jelly beans. Charlie's personal recipe. Our most polarising menu item. Loved by ghouls.",
        "nutrition-outline",
        "https://paddyspub.example/menu",
    ),
    (
        "Private Hire & Large Parties",
        "Push the window booths together and we'll seat your whole group. Ask about the combined tables when you book, or call the location direct.",
        "people-outline",
        None,
    ),
]

SOCIAL_LINKS = [
    ("Instagram", "https://instagram.com/paddyspub", "logo-instagram"),
    ("Yelp", "https://yelp.com/biz/paddys-pub", "star-outline"),
    ("Our blog", "https://paddyspub.example/blog", "link-outline"),
]

# (name, email, special_requests) — a deliberate mix: guests with no email at
# all (phone bookings), guests with no requests, and one long request that
# stress-tests the admin grid's text wrapping.
GUESTS = [
    ("Dee Reynolds", "dee@paddyspub.com", None),
    ("Dennis Reynolds", "dennis@paddyspub.com", "Window seat please"),
    ("Charlie Kelly", "charlie@paddyspub.com", "No cats were harmed"),
    ("Mac McDonald", "mac@paddyspub.com", None),
    ("Frank Reynolds", "frank@paddyspub.com", "Rum ham on the side"),
    ("The Waitress", "waitress@paddyspub.com", None),
    ("Rickety Cricket", "cricket@paddyspub.com", "Step-free access required, please seat near the door"),
    ("The McPoyle Bros", "mcpoyle@paddyspub.com", "Milk only, no exceptions"),
    ("Gail the Snail", "gail@paddyspub.com", None),
    ("The Lawyer", "lawyer@paddyspub.com", "Quiet table preferred"),
    ("Uncle Jack", "jack@paddyspub.com", "Keep hands visible"),
    ("Artemis Dubois", "artemis@paddyspub.com", "Improv-friendly zone"),
    ("Bill Ponderosa", None, None),
    ("Maureen Ponderosa", None, "Allergic to cats. Severely."),
    ("Z", "z@paddyspub.com", None),
    ("Ben the Soldier", "ben@paddyspub.com", None),
    ("Duncan the Landlord", None, "Booked by phone — will settle the tab in cash"),
    ("Ruby Taft", "ruby@paddyspub.com", None),
    (
        "Bonnie Kelly",
        "bonnie@paddyspub.com",
        "Table away from the speakers if you have one, and we'll need a high chair plus somewhere to park a walker. Celebrating a birthday so a candle would be lovely.",
    ),
    ("Luther McDonald", None, None),
]

REF_ADJECTIVES = [
    "crispy", "golden", "smoky", "rustic", "zesty", "tender", "glazed", "roasted",
    "grilled", "braised", "fresh", "savory", "spiced", "toasted", "charred",
    "caramelized", "marinated", "seared", "buttery", "herbed", "honeyed", "tangy",
    "velvety", "hearty", "bold", "bright",
]
REF_FOODS = [
    "basil", "saffron", "truffle", "thyme", "olive", "pepper", "mango", "lemon",
    "ginger", "garlic", "mint", "parsley", "rosemary", "vanilla", "paprika", "cumin",
    "fennel", "tarragon", "cardamom", "coriander", "turmeric", "clove", "nutmeg",
    "dill", "sage", "oregano", "mustard", "cinnamon", "sesame", "lavender", "wasabi",
    "capers", "shallot",
]

# Service bands, as local wall-clock minutes-from-midnight. Slots are drawn from
# the intersection of these bands with the location's resolved hours for the
# day, so a location that opens at 16:00 simply gets no lunch covers.
SERVICE_BANDS = [
    ("lunch", 11 * 60 + 30, 14 * 60 + 30),
    ("dinner", 17 * 60 + 30, 21 * 60 + 30),
    ("late", 21 * 60 + 30, 26 * 60),  # past midnight, for the late-close days
]


# ─── SQL helpers ─────────────────────────────────────────────────────────────


def q(value):
    """Render a Python value as a SQL literal, escaping embedded quotes."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def insert(table, row):
    cols = ",".join(row.keys())
    vals = ",".join(q(v) for v in row.values())
    return f"INSERT INTO {table}({cols}) VALUES({vals});"


def utc_str(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


# ─── Dataset assembly ────────────────────────────────────────────────────────


def build_dataset(now_utc):
    """Assign ids to the declarative location tree and resolve relative dates."""
    restaurants, sections, tables, groups, memberships = [], [], [], [], []
    rid = sid = tid = gid = 0

    for spec in LOCATIONS:
        rid += 1
        paused_until = None
        if spec.get("paused_days"):
            paused_until = utc_str(now_utc + timedelta(days=spec["paused_days"]))

        open_hours_json = None
        if spec.get("open_hours"):
            open_hours_json = json.dumps(
                {str(day): {"open": o, "close": c} for day, (o, c) in sorted(spec["open_hours"].items())},
                separators=(",", ":"),
            )

        restaurants.append(
            {
                "id": rid,
                "spec": spec,
                "row": {
                    "Id": rid,
                    "Name": spec["name"],
                    "Address": spec["address"],
                    "OpenTime": spec["open_time"],
                    "CloseTime": spec["close_time"],
                    "OpenDays": spec["open_days"],
                    "Timezone": spec["timezone"],
                    "BookingsPausedUntil": paused_until,
                    "Tags": spec.get("tags"),
                    "ImageUrl": spec.get("image"),
                    "IsArchived": bool(spec.get("archived")),
                    "DefaultBookingDurationMinutes": spec["duration"],
                    "BookingSlotIntervalMinutes": spec["slot_interval"],
                    "OpenHoursJson": open_hours_json,
                    "WalkInOnly": bool(spec.get("walk_in_only")),
                    "WalkInDays": spec.get("walk_in_days"),
                    "Description": spec.get("description"),
                    "MenuUrl": spec.get("menu_url"),
                    "PhoneNumber": spec.get("phone"),
                    "EmailAddress": spec.get("email"),
                    "MaxTableOversizeSeats": spec.get("max_oversize"),
                    "BookingRefFormat": spec["ref_format"],
                },
            }
        )

        by_name = {}
        for order, sec in enumerate(spec["sections"]):
            sid += 1
            sections.append({"Id": sid, "Name": sec["name"], "RestaurantId": rid, "SortOrder": order})
            for tname, seats in sec["tables"]:
                tid += 1
                tables.append({"Id": tid, "Name": tname, "Seats": seats, "SectionId": sid})
                by_name[tname] = {"id": tid, "seats": seats, "section_id": sid}

        resolved_groups = []
        for grp in spec.get("groups", []):
            gid += 1
            member_ids = [by_name[n]["id"] for n in grp["tables"]]
            groups.append(
                {
                    "Id": gid,
                    "Name": grp["name"],
                    "RestaurantId": rid,
                    "CombinedSeats": grp["combined_seats"],
                }
            )
            memberships += [{"TableGroupId": gid, "TableId": mid} for mid in member_ids]
            resolved_groups.append(
                {
                    "id": gid,
                    "combined_seats": grp["combined_seats"],
                    "member_ids": member_ids,
                    "section_id": by_name[grp["tables"][0]]["section_id"],
                }
            )

        # Booking generation needs the resolved inventory, keyed by table name.
        restaurants[-1]["tables_by_name"] = by_name
        restaurants[-1]["groups"] = resolved_groups

    return {
        "restaurants": restaurants,
        "sections": sections,
        "tables": tables,
        "groups": groups,
        "memberships": memberships,
    }


# ─── Config SQL ──────────────────────────────────────────────────────────────

CONFIG_TABLES = [
    # The activity log is wiped on every reset, and for a stronger reason than the rest of
    # this list: the demo's admin password is public, so its entries are visitors' actions
    # and visitors' IP addresses, shown to every other visitor. The seeded entries that
    # replace them are emitted with the bookings, which is where the refs they point at
    # are generated.
    "AdminAuditEntries",
    "Highlights",
    "SocialLinks",
    "TableGroupMemberships",
    "TableGroups",
    "Tables",
    "Sections",
    "Restaurants",
    "BrandSettings",
    "EmailSettings",
]


def emit_config(ds):
    out = ["-- ── Config: brand, locations, sections, tables, groups, home page ──"]
    for t in CONFIG_TABLES:
        out.append(f"DELETE FROM {t};")
    seqs = ",".join(q(t) for t in CONFIG_TABLES)
    out.append(f"DELETE FROM sqlite_sequence WHERE name IN ({seqs});")

    out.append("")
    out.append("-- EmailSettings is left empty on purpose: no SMTP credentials in source control.")
    out.append(insert("BrandSettings", {"Id": 1, **BRAND}))

    out.append("")
    out.append("-- Locations")
    for r in ds["restaurants"]:
        out.append(insert("Restaurants", r["row"]))

    out.append("")
    out.append("-- Sections (SortOrder is explicit display order, not insertion order)")
    for s in ds["sections"]:
        out.append(insert("Sections", s))

    out.append("")
    out.append("-- Tables")
    for t in ds["tables"]:
        out.append(insert("Tables", t))

    if ds["groups"]:
        out.append("")
        out.append("-- Combinable table groups. Members stay individually bookable; grouping")
        out.append("-- only deprioritizes them in auto-assign.")
        for g in ds["groups"]:
            out.append(insert("TableGroups", g))
        for m in ds["memberships"]:
            out.append(insert("TableGroupMemberships", m))

    out.append("")
    out.append("-- Highlights (Link=NULL renders a static card; a Link makes the card clickable)")
    for i, (title, body, icon, link) in enumerate(HIGHLIGHTS):
        out.append(
            insert(
                "Highlights",
                {"Id": i + 1, "Title": title, "Body": body, "IconKey": icon, "SortOrder": i, "Link": link},
            )
        )

    out.append("")
    out.append("-- Social links (footer)")
    for i, (label, url, icon) in enumerate(SOCIAL_LINKS):
        out.append(
            insert("SocialLinks", {"Id": i + 1, "Label": label, "Url": url, "IconKey": icon, "SortOrder": i})
        )

    return out


# ─── Media ───────────────────────────────────────────────────────────────────
# MediaService writes uploads into deterministic slots — hero.<ext>,
# location-<id>.<ext>, menu-<id>.pdf — so the seed can discover what artwork
# actually exists instead of hardcoding paths. This is what lets an uploaded
# image survive the demo reset: the config step leaves ImageUrl NULL, and this
# step points it back at whatever file is on disk, whatever extension it has.
#
# It only ever SETS a URL, never nulls one out, so it composes safely on top of
# the config step (which has already cleared the columns) and can also be run
# on its own. A served menu file wins over an external menu link, because
# uploading a PDF for a location is the more deliberate act.

IMAGE_EXTENSIONS = ("jpg", "jpeg", "png", "webp")


def _media_url(path):
    """/media/<name>?v=<mtime-ms>, matching MediaService's cache-buster format."""
    stamp = int(path.stat().st_mtime * 1000)
    return f"/media/{path.name}?v={stamp}"


def emit_media(ds, media_dir):
    from pathlib import Path

    root = Path(media_dir)
    out = [f"-- ── Media: URLs derived from the files in {media_dir} ──"]
    if not root.is_dir():
        out.append(f"-- directory not found, nothing to link")
        return out, 0

    linked = 0

    hero = next(
        (p for ext in IMAGE_EXTENSIONS for p in sorted(root.glob(f"hero.{ext}"))),
        None,
    )
    if hero:
        out.append(f"UPDATE BrandSettings SET HeaderImageUrl={q(_media_url(hero))};")
        linked += 1

    for r in ds["restaurants"]:
        rid = r["id"]
        image = next(
            (p for ext in IMAGE_EXTENSIONS for p in sorted(root.glob(f"location-{rid}.{ext}"))),
            None,
        )
        if image:
            out.append(f"UPDATE Restaurants SET ImageUrl={q(_media_url(image))} WHERE Id={rid};")
            linked += 1

        menu = root / f"menu-{rid}.pdf"
        if menu.is_file():
            out.append(f"UPDATE Restaurants SET MenuUrl={q(_media_url(menu))} WHERE Id={rid};")
            linked += 1

    if linked == 0:
        out.append("-- no matching media files found")
    return out, linked


# ─── Admin accounts ──────────────────────────────────────────────────────────


def resolve_admin_credentials(settings_file):
    """
    The Owner's email and password, from an ASP.NET appsettings JSON when one is
    given, else the ADMIN_EMAIL/ADMIN_PASSWORD environment variables the API's own
    bootstrap falls back to. Never taken from argv: a password there is readable by
    any local user through `ps`.
    """
    email = password = None

    if settings_file:
        path = pathlib.Path(settings_file)
        if not path.is_file():
            raise SystemExit(f"settings file not found: {settings_file}")
        admin = json.loads(path.read_text(encoding="utf-8")).get("Admin") or {}
        email = admin.get("Email") or None
        password = admin.get("Password") or None

    email = email or os.environ.get("ADMIN_EMAIL") or "admin@openresto.com"
    password = password or os.environ.get("ADMIN_PASSWORD")
    if not password:
        raise SystemExit(
            "no admin password available — set ADMIN_PASSWORD or pass --settings-file"
        )
    return email.strip().lower(), password


def _derive_credential(secret):
    """PBKDF2-SHA256, 100k iterations, 16-byte salt, 32-byte key — matches PasswordService."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", secret.encode(), salt, 100_000, dklen=32)
    return base64.b64encode(key).decode(), base64.b64encode(salt).decode()


def build_demo_accounts(settings_file):
    """
    The curated account rows, with credentials already derived. Reading the configured
    password and hashing it both happen here, so the plaintext never enters a structure
    that reaches the emitted SQL — which carries only the hash and the salt, exactly like
    a row the API would have written. Each row gets its own salt even though the two
    share a password.
    """
    owner_email, secret = resolve_admin_credentials(settings_file)

    # DisplayName None on purpose: between the two rows, both branches of the UI's
    # "display name, falling back to email" render.
    identities = [
        (owner_email, None, "Owner"),
        (DEMO_MANAGER_EMAIL, DEMO_MANAGER_DISPLAY_NAME, "Manager"),
    ]

    accounts = []
    for email, display_name, role in identities:
        password_hash, password_salt = _derive_credential(secret)
        accounts.append(
            {
                "Email": email.strip().lower(),
                "PasswordHash": password_hash,
                "PasswordSalt": password_salt,
                "DisplayName": display_name,
                "Role": role,
                "IsActive": True,
            }
        )
    return accounts


def emit_accounts(accounts, now_utc):
    """
    Replaces every admin account with the curated pair. Wiping first is the point on
    the demo: its admin password is public, so an account a visitor invited themselves
    must not survive the reset, for the same reason their uploads don't.

    API keys are deleted explicitly rather than left to the AdminApiKeys -> AdminCredentials
    cascade, because this script runs under PRAGMA foreign_keys=OFF and the cascade therefore
    never fires. Without the explicit delete a visitor's key outlived every reset: the wipe
    reseeds AdminCredentials from Id 1, so the orphaned row's UserId lands back on the new
    Owner and the key keeps authenticating, for the whole year until it expires.
    """
    out = [
        "-- ── Admin accounts: the bootstrap Owner + a demo Manager ──",
        "DELETE FROM AdminApiKeys;",
        "DELETE FROM sqlite_sequence WHERE name = 'AdminApiKeys';",
        "DELETE FROM AdminCredentials;",
        "DELETE FROM sqlite_sequence WHERE name = 'AdminCredentials';",
    ]

    created = utc_str(now_utc)
    for account in accounts:
        out.append(insert("AdminCredentials", {**account, "CreatedAt": created}))

    return out, len(accounts)


# ─── Booking generation ──────────────────────────────────────────────────────


def parse_hhmm(text):
    h, m = text.split(":")
    return int(h) * 60 + int(m)


def hours_for_day(spec, iso_day):
    override = (spec.get("open_hours") or {}).get(iso_day)
    if override:
        return override
    return spec["open_time"], spec["close_time"]


def day_slot_grid(spec, iso_day):
    """Local minutes-from-midnight for every bookable start on this ISO day.

    Mirrors AvailabilityService: a close time at or before the open time rolls
    into the next day (23:00→01:30 wraps; 00:00→00:00 is a full 24 hours), and
    a start is only offered if the whole booking fits before close.
    """
    open_txt, close_txt = hours_for_day(spec, iso_day)
    start = parse_hhmm(open_txt)
    end = parse_hhmm(close_txt)
    if end <= start:
        end += 24 * 60

    step = spec["slot_interval"]
    duration = spec["duration"]
    return list(range(start, end - duration + 1, step))


class UnitLedger:
    """Tracks occupancy so seeded bookings never conflict with each other.

    Booking a table also consumes its group (the tables can't be pushed
    together while one is taken) and booking a group consumes every member —
    the same mutual exclusion IBookingRepository.IsUnitBookedOnDateAsync
    enforces at runtime. The previous seeder deduplicated on
    (table, date, time) only, which let a 90-minute booking at 18:00 sit on
    top of another at 18:30 on the same table.
    """

    def __init__(self):
        self._busy = {}  # key -> list of (start, end) UTC datetimes

    @staticmethod
    def _overlaps(spans, start, end):
        return any(s < end and start < e for s, e in spans)

    def is_free(self, keys, start, end):
        return not any(self._overlaps(self._busy.get(k, []), start, end) for k in keys)

    def reserve(self, keys, start, end):
        for k in keys:
            self._busy.setdefault(k, []).append((start, end))


def make_ref_pool(rng):
    """Unique-reference minter, per format, matching the server's generators."""
    used = set()

    def mint(ref_format):
        while True:
            if ref_format == 1:  # Numeric — 8 digits, never a leading zero
                ref = str(rng.randint(10_000_000, 99_999_999))
            else:
                adj = rng.choice(REF_ADJECTIVES)
                a, b = rng.sample(REF_FOODS, 2)
                ref = f"{adj}-{a}-{b}"
            if ref not in used:
                used.add(ref)
                return ref

    return mint


def bookable_units(r):
    """Every unit a booking can reserve, as (kind, id, capacity, section_id, keys).

    `keys` is the ledger's mutual-exclusion set: a table locks itself and any
    group it belongs to; a group locks itself and all of its members.
    """
    units = []
    member_to_groups = {}
    for g in r["groups"]:
        for mid in g["member_ids"]:
            member_to_groups.setdefault(mid, []).append(g["id"])

    for name, t in r["tables_by_name"].items():
        keys = [("t", t["id"])] + [("g", gid) for gid in member_to_groups.get(t["id"], [])]
        units.append(("table", t["id"], t["seats"], t["section_id"], keys))

    for g in r["groups"]:
        keys = [("g", g["id"])] + [("t", mid) for mid in g["member_ids"]]
        units.append(("group", g["id"], g["combined_seats"], g["section_id"], keys))

    return units


def party_size_for(rng, capacity, max_oversize):
    """A plausible party for a unit, honouring the location's oversize cap."""
    low = 1 if max_oversize is None else max(1, capacity - max_oversize)
    choices = list(range(low, capacity + 1))
    # Weight towards a full-ish table; solo diners are the exception.
    weights = [1 if s == 1 else 3 for s in choices]
    return rng.choices(choices, weights=weights, k=1)[0]


def emit_bookings(ds, now_utc, days_back, days_forward, occupancy, rng):
    out = [
        "-- ── Bookings + admin notifications ──",
        "DELETE FROM AdminNotifications;",
        "DELETE FROM EmailFailures;",
        "DELETE FROM Bookings;",
        "DELETE FROM sqlite_sequence WHERE name IN ('Bookings','AdminNotifications','EmailFailures');",
        "",
    ]

    mint = make_ref_pool(rng)
    ledger = UnitLedger()
    guest_idx = 0
    bookings = []  # (row, restaurant_name) — ids assigned after sorting
    today = now_utc.date()

    for r in ds["restaurants"]:
        spec = r["spec"]
        tz = ZoneInfo(spec["timezone"])
        open_days = {int(d) for d in spec["open_days"].split(",") if d.strip()}
        walk_in_days = {int(d) for d in (spec.get("walk_in_days") or "").split(",") if d.strip()}
        duration = spec["duration"]
        units = bookable_units(r)

        for offset in range(-days_back, days_forward + 1):
            local_day = today + timedelta(days=offset)
            iso_day = local_day.isoweekday()
            if iso_day not in open_days:
                continue

            # Walk-in days take no online bookings, but AdminService.CreateBookingAsync
            # is intentionally exempt so staff can log walk-ins — seed a couple so the
            # admin grid shows what that looks like.
            walk_in = spec.get("walk_in_only") or iso_day in walk_in_days

            grid = day_slot_grid(spec, iso_day)
            if not grid:
                continue

            candidates = []
            for minutes in grid:
                band = next((b for b, lo, hi in SERVICE_BANDS if lo <= minutes < hi), None)
                if band:
                    candidates.append(minutes)
            if not candidates:
                continue

            target = max(1, int(len(units) * occupancy))
            if walk_in:
                target = min(target, 2)

            attempts = 0
            placed = 0
            while placed < target and attempts < target * 6:
                attempts += 1
                unit_kind, unit_id, capacity, section_id, keys = rng.choice(units)
                minutes = rng.choice(candidates)

                local_start = datetime.combine(local_day, datetime.min.time()) + timedelta(minutes=minutes)
                start_utc = local_start.replace(tzinfo=tz).astimezone(timezone.utc)
                end_utc = start_utc + timedelta(minutes=duration)

                if not ledger.is_free(keys, start_utc, end_utc):
                    continue
                ledger.reserve(keys, start_utc, end_utc)
                placed += 1

                name, email, special = GUESTS[guest_idx % len(GUESTS)]
                guest_idx += 1
                seats = party_size_for(rng, capacity, spec.get("max_oversize"))
                if walk_in:
                    special = "Walk-in, recorded at the door"

                # Past bookings cancel more often than upcoming ones.
                cancel_rate = 0.15 if offset < 0 else 0.05
                cancelled = rng.random() < cancel_rate
                cancelled_at = None
                if cancelled:
                    # Cancelled some time before the booking, and never in the future.
                    lead = timedelta(hours=rng.randint(1, 72))
                    cancelled_at = min(start_utc - lead, now_utc)

                bookings.append(
                    (
                        {
                            "BookingRef": mint(spec["ref_format"]),
                            "CustomerName": name,
                            "CustomerEmail": email,
                            "Date": utc_str(start_utc),
                            "EndTime": utc_str(end_utc),
                            "Seats": seats,
                            "SectionId": section_id,
                            "TableId": unit_id if unit_kind == "table" else None,
                            "TableGroupId": unit_id if unit_kind == "group" else None,
                            "RestaurantId": r["id"],
                            "IsCancelled": cancelled,
                            "CancelledAt": utc_str(cancelled_at) if cancelled_at else None,
                            "SpecialRequests": special,
                        },
                        r["row"]["Name"],
                        start_utc,
                    )
                )

    # Deleting a table or section nulls these FKs rather than cascading the
    # booking away (DeleteTableAsync / DeleteSectionAsync). Seed a couple of
    # survivors so the admin grid's "Table"/"Section" fallback labels render.
    first = ds["restaurants"][0]
    for days_ago in (3, 9):
        start_utc = (now_utc - timedelta(days=days_ago)).replace(minute=0, second=0, microsecond=0)
        bookings.append(
            (
                {
                    "BookingRef": mint(first["spec"]["ref_format"]),
                    "CustomerName": "Rex the Bouncer",
                    "CustomerEmail": "rex@paddyspub.com",
                    "Date": utc_str(start_utc),
                    "EndTime": utc_str(start_utc + timedelta(minutes=first["spec"]["duration"])),
                    "Seats": 2,
                    "SectionId": None,
                    "TableId": None,
                    "TableGroupId": None,
                    "RestaurantId": first["id"],
                    "IsCancelled": False,
                    "CancelledAt": None,
                    "SpecialRequests": "Table was removed in a refit — booking kept",
                },
                first["row"]["Name"],
                start_utc,
            )
        )

    # Bookings the location's *current* schedule would no longer accept. Everything
    # above is generated against the rules the server enforces, so the schedule-conflict
    # panel and its dashboard count would have nothing to report on a fresh demo and the
    # feature would be invisible. These are the case it exists for: a schedule narrowed
    # after the bookings were taken. One lands on a day the location no longer opens,
    # one an hour and a half before it now opens.
    #
    # Deliberately the only seeded rows that break the never-conflict rule. They are
    # upcoming and non-cancelled because the read excludes anything else.
    strand_target = ds["restaurants"][0]
    strand_spec = strand_target["spec"]
    strand_tz = ZoneInfo(strand_spec["timezone"])
    strand_open_days = {int(d) for d in strand_spec["open_days"].split(",") if d.strip()}
    strand_units = [u for u in bookable_units(strand_target) if u[0] == "table"]

    def first_upcoming(wanted_open):
        for offset in range(2, max(days_forward, 2) + 1):
            day = today + timedelta(days=offset)
            if (day.isoweekday() in strand_open_days) == wanted_open:
                return day
        return None

    closed_day = first_upcoming(wanted_open=False)
    open_day = first_upcoming(wanted_open=True)
    strand_open_minutes = parse_hhmm(hours_for_day(strand_spec, (open_day or today).isoweekday())[0])

    stranded = []
    if closed_day and strand_units:
        stranded.append((closed_day, 19 * 60, "Booked before Sundays were dropped"))
    if open_day and strand_units and strand_open_minutes >= 90:
        stranded.append((open_day, strand_open_minutes - 90, "Booked before the kitchen opened later"))

    for i, (local_day, minutes, note) in enumerate(stranded):
        _, unit_id, capacity, section_id, keys = strand_units[i % len(strand_units)]
        local_start = datetime.combine(local_day, datetime.min.time()) + timedelta(minutes=minutes)
        start_utc = local_start.replace(tzinfo=strand_tz).astimezone(timezone.utc)
        end_utc = start_utc + timedelta(minutes=strand_spec["duration"])
        ledger.reserve(keys, start_utc, end_utc)

        name, email, _ = GUESTS[guest_idx % len(GUESTS)]
        guest_idx += 1
        bookings.append(
            (
                {
                    "BookingRef": mint(strand_spec["ref_format"]),
                    "CustomerName": name,
                    "CustomerEmail": email,
                    "Date": utc_str(start_utc),
                    "EndTime": utc_str(end_utc),
                    "Seats": min(2, capacity),
                    "SectionId": section_id,
                    "TableId": unit_id,
                    "TableGroupId": None,
                    "RestaurantId": strand_target["id"],
                    "IsCancelled": False,
                    "CancelledAt": None,
                    "SpecialRequests": note,
                },
                strand_target["row"]["Name"],
                start_utc,
            )
        )

    # Insert in chronological order so Bookings.Id correlates with time, the
    # way it would on a live system.
    bookings.sort(key=lambda b: b[2])

    out.append(f"-- {len(bookings)} bookings across {len(ds['restaurants'])} locations")
    notifications = []
    for i, (row, restaurant_name, start_utc) in enumerate(bookings, start=1):
        out.append(insert("Bookings", {"Id": i, **row}))

        # Notifications only exist for recent activity — the bell should have
        # something in it on a fresh demo, but not 400 unread items.
        age = now_utc - start_utc
        if timedelta(days=-2) <= age <= timedelta(days=4):
            notifications.append((i, row, restaurant_name))

    rng.shuffle(notifications)
    notifications = notifications[:24]
    notifications.sort(key=lambda n: n[0])

    if notifications:
        out.append("")
        out.append("-- Admin notifications: most read, the newest few unread so the bell has a badge.")
        nid = 0
        for idx, (booking_id, row, restaurant_name) in enumerate(notifications):
            nid += 1
            cancelled = row["IsCancelled"]
            created = row["CancelledAt"] if cancelled else row["Date"]
            unread = idx >= len(notifications) - 5
            out.append(
                insert(
                    "AdminNotifications",
                    {
                        "Id": nid,
                        "RestaurantId": row["RestaurantId"],
                        "BookingId": booking_id,
                        "BookingRef": row["BookingRef"],
                        "Type": "BookingCancelled" if cancelled else "BookingCreated",
                        "CustomerName": row["CustomerName"] or "Guest",
                        "BookingDate": row["Date"],
                        "Seats": row["Seats"],
                        "RestaurantName": restaurant_name,
                        "IsRead": not unread,
                        "CreatedAt": created,
                    },
                )
            )

        # The capacity alert carries no booking of its own (BookingId NULL,
        # empty ref/customer) — see BookingNotificationService.
        nid += 1
        out.append(
            insert(
                "AdminNotifications",
                {
                    "Id": nid,
                    "RestaurantId": ds["restaurants"][0]["id"],
                    "BookingId": None,
                    "BookingRef": "",
                    "Type": "RestaurantNearlyFull",
                    "CustomerName": "",
                    "BookingDate": utc_str(now_utc),
                    "Seats": 0,
                    "RestaurantName": ds["restaurants"][0]["row"]["Name"],
                    "IsRead": False,
                    "CreatedAt": utc_str(now_utc - timedelta(hours=2)),
                },
            )
        )

    out.extend(emit_audit_entries(ds, bookings, now_utc))

    return out, len(bookings)


# ─── Activity log ────────────────────────────────────────────────────────────
# Only actions an admin actually takes belong here: a diner booking a table is
# not an admin action and produces no entry, which is why these are cancels,
# pauses and settings edits rather than one row per seeded booking.
#
# ActorUserId is NULL throughout. The accounts section runs after this one and
# wipes AdminCredentials, which would SET NULL any id written here anyway — and
# an entry that still reads correctly with no account behind it is exactly what
# the denormalized actor columns exist for.


def emit_audit_entries(ds, bookings, now_utc):
    def entry(minutes_ago, action, **fields):
        row = {
            "OccurredAt": utc_str(now_utc - timedelta(minutes=minutes_ago)),
            "ActorUserId": None,
            "ActorEmail": DEMO_MANAGER_EMAIL,
            "ActorDisplayName": DEMO_MANAGER_DISPLAY_NAME,
            "ActorRole": "Manager",
            "Action": action,
            "TargetType": None,
            "TargetId": None,
            "TargetLabel": None,
            "RestaurantId": None,
            "Summary": None,
            "ChangesJson": None,
            "HttpMethod": "POST",
            "Path": "/api/admin",
            "StatusCode": 204,
            "IpAddress": "203.0.113.42",
            "UserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        }
        row.update(fields)
        return row

    first = ds["restaurants"][0]
    cancelled = [(i, row) for i, (row, _, _) in enumerate(bookings, start=1) if row["IsCancelled"]][-3:]

    rows = [
        entry(
            2,
            "auth.login",
            Path="/api/admin/auth/login",
            StatusCode=200,
            Summary=f"{DEMO_MANAGER_DISPLAY_NAME} signed in",
        ),
        # A rejected attempt is exactly what a trail gets consulted about, so 4xx rows are kept.
        entry(
            9,
            "auth.login_failed",
            ActorEmail="someone@example.com",
            ActorDisplayName=None,
            ActorRole="",
            Path="/api/admin/auth/login",
            StatusCode=401,
            Summary="Failed sign-in attempt",
            IpAddress="198.51.100.7",
        ),
        entry(
            34,
            "restaurant.pause",
            TargetType="Restaurant",
            TargetId=str(first["id"]),
            TargetLabel=first["row"]["Name"],
            RestaurantId=first["id"],
            Path=f"/api/admin/restaurants/{first['id']}/pause",
            StatusCode=200,
            Summary="Paused new bookings for 60 minutes",
        ),
        entry(
            96,
            "brand.update",
            TargetType="Brand",
            HttpMethod="PATCH",
            Path="/api/brand",
            StatusCode=200,
            Summary="Updated the homepage tagline",
            ChangesJson='{"tagline":{"before":"Book a table","after":"Reserve your table"}}',
        ),
        entry(
            210,
            "table.update",
            TargetType="Table",
            TargetId="4",
            TargetLabel="Table 4",
            RestaurantId=first["id"],
            HttpMethod="PUT",
            Path=f"/api/restaurants/{first['id']}/sections/1/tables/4",
            StatusCode=200,
            Summary="Resized Table 4 from 2 to 4 seats",
            ChangesJson='{"seats":{"before":"2","after":"4"}}',
        ),
        # The customer's name is not recorded, here or anywhere: booking history is
        # deliberately GDPR-purgeable, and an entry holding it would put it back.
        *[
            entry(
                360 + index * 47,
                "booking.cancel",
                TargetType="Booking",
                TargetId=str(booking_id),
                TargetLabel=row["BookingRef"],
                RestaurantId=row["RestaurantId"],
                Path=f"/api/admin/bookings/{booking_id}/cancel",
                Summary=f"Cancelled booking {row['BookingRef']}",
            )
            for index, (booking_id, row) in enumerate(cancelled)
        ],
    ]

    out = [
        "",
        f"-- Activity log: {len(rows)} admin actions (see AdminAuditEntry).",
        # Repeated from the config section so this one stays self-contained: applying
        # `bookings` on its own must not collide with the explicit ids below.
        "DELETE FROM AdminAuditEntries;",
        "DELETE FROM sqlite_sequence WHERE name = 'AdminAuditEntries';",
    ]
    out.extend(insert("AdminAuditEntries", {"Id": i, **row}) for i, row in enumerate(rows, start=1))
    return out


# ─── CLI ─────────────────────────────────────────────────────────────────────


def main():
    p = argparse.ArgumentParser(description="Emit OpenResto demo-data SQL on stdout.")
    p.add_argument(
        "section",
        choices=["config", "bookings", "media", "accounts", "all"],
        nargs="?",
        default="all",
    )
    p.add_argument(
        "--media-dir",
        default=None,
        help="directory to scan for hero/location/menu files; required by the 'media' section",
    )
    p.add_argument(
        "--settings-file",
        default=None,
        help="appsettings JSON to read Admin:Email/Admin:Password from ('accounts' section)",
    )
    p.add_argument("--days-back", type=int, default=14, help="days of history to generate (default 14)")
    p.add_argument("--days-forward", type=int, default=14, help="days of upcoming bookings (default 14)")
    p.add_argument(
        "--occupancy",
        type=float,
        default=0.55,
        help="fraction of each location's bookable units to fill per service day (default 0.55)",
    )
    p.add_argument("--seed", type=int, default=None, help="RNG seed, for reproducible output")
    args = p.parse_args()

    if not 0 < args.occupancy <= 1:
        p.error("--occupancy must be greater than 0 and at most 1")
    if args.section == "media" and not args.media_dir:
        p.error("the 'media' section requires --media-dir")

    rng = random.Random(args.seed)
    now_utc = datetime.now(timezone.utc)
    ds = build_dataset(now_utc)

    lines = [
        "-- GENERATED by scripts/demo_data.py — do not edit by hand.",
        f"-- Generated at {utc_str(now_utc)} UTC.",
        "PRAGMA foreign_keys=OFF;",
        "PRAGMA busy_timeout=5000;",
        "BEGIN;",
        "",
    ]

    booking_count = 0
    if args.section in ("config", "all"):
        lines += emit_config(ds)
        lines.append("")
    if args.section in ("bookings", "all"):
        booking_lines, booking_count = emit_bookings(
            ds, now_utc, args.days_back, args.days_forward, args.occupancy, rng
        )
        lines += booking_lines
        lines.append("")

    # Accounts stay out of 'all': they need a password the generator cannot invent,
    # so every caller asks for them explicitly and supplies one.
    account_count = 0
    if args.section == "accounts":
        account_lines, account_count = emit_accounts(
            build_demo_accounts(args.settings_file), now_utc
        )
        lines += account_lines
        lines.append("")

    # Media runs last so it overwrites the NULLs the config step wrote.
    media_count = 0
    if args.section == "media" or (args.section == "all" and args.media_dir):
        media_lines, media_count = emit_media(ds, args.media_dir)
        lines += media_lines
        lines.append("")

    lines += ["COMMIT;", "PRAGMA foreign_keys=ON;"]

    print("\n".join(lines))
    if args.section == "accounts":
        print(f"[demo_data] {account_count} admin accounts", file=sys.stderr)
        return

    summary = f"[demo_data] {len(ds['restaurants'])} locations, {len(ds['tables'])} tables"
    if args.section in ("bookings", "all"):
        summary += f", {booking_count} bookings"
    if args.media_dir or args.section == "media":
        summary += f", {media_count} media files linked"
    print(summary, file=sys.stderr)


if __name__ == "__main__":
    main()
