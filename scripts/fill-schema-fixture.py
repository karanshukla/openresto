#!/usr/bin/env python3
"""
fill-schema-fixture.py — put one representative row in every table of a SQLite database.

Used by the migration-safety CI job. That job used to build a database from the previous
release's migrations and immediately apply the new ones, which proves the two paths agree
on *schema* but never runs a migration against *data*. Those are different tests, and the
difference is not academic: SQLite accepts

    ALTER TABLE t ADD COLUMN c TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

on an empty table and rejects it the moment the table has a row ("Cannot add a column with
non-constant default"). A migration that does that passes an empty-database check and then
fails on every real install. Seeding a row before the upgrade is what makes the check
represent an actual upgrade.

The rows are deliberately generic rather than realistic — the point is that each table is
non-empty, not that the data means anything. Emails get a mixed-case, space-padded value so
a normalising migration has something to normalise.

Usage:
    python3 scripts/fill-schema-fixture.py path/to.db
"""

import sqlite3
import sys

# EF Core reads this table to decide what to apply, so a fixture row would corrupt the run.
SKIP_TABLES = {"__EFMigrationsHistory"}

DATE_HINTS = ("date", "time", "at")
FIXTURE_DATE = "2026-01-01 00:00:00"


def looks_like_date(column_name):
    lowered = column_name.lower()
    return any(hint in lowered for hint in DATE_HINTS) or lowered.endswith("at")


def fixture_value(column_name, declared_type):
    """A value SQLite will accept for this column, biased toward exercising the migration."""
    kind = (declared_type or "").upper()

    if "INT" in kind:
        return 1
    if any(k in kind for k in ("REAL", "FLOA", "DOUB", "NUMERIC", "DECIMAL")):
        return 1.0
    if "BLOB" in kind:
        return b"\x00"

    # Everything else is stored as TEXT by EF, including DateTime.
    if looks_like_date(column_name):
        return FIXTURE_DATE
    if "email" in column_name.lower():
        # Padded and mixed-case on purpose: a migration that trims/lower-cases emails should
        # have something to actually change.
        return "  Fixture@Example.COM  "
    return "fixture"


def insertable_columns(conn, table):
    """
    (all, required) column lists. "Required" means NOT NULL with no default.

    A lone INTEGER PRIMARY KEY is the rowid alias, so it is left out and SQLite assigns it.
    That only holds for a single-column key: in a composite key (TableGroupMemberships) the
    parts are ordinary NOT NULL columns that must be supplied, so the count matters.
    """
    columns = list(conn.execute(f'PRAGMA table_info("{table}")'))
    pk_columns = [c for c in columns if c[5]]
    rowid_alias = (
        pk_columns[0][1]
        if len(pk_columns) == 1 and (pk_columns[0][2] or "").upper() == "INTEGER"
        else None
    )

    all_cols, required = [], []
    for _cid, name, decl_type, notnull, default, _pk in columns:
        if name == rowid_alias:
            continue
        all_cols.append((name, decl_type))
        if notnull and default is None:
            required.append((name, decl_type))
    return all_cols, required


def insert_row(conn, table, columns):
    if not columns:
        conn.execute(f'INSERT INTO "{table}" DEFAULT VALUES')
        return
    names = ",".join(f'"{name}"' for name, _ in columns)
    placeholders = ",".join("?" for _ in columns)
    values = [fixture_value(name, decl_type) for name, decl_type in columns]
    conn.execute(f'INSERT INTO "{table}"({names}) VALUES({placeholders})', values)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: fill-schema-fixture.py path/to.db")

    conn = sqlite3.connect(sys.argv[1])
    # Off so tables can be filled in any order without satisfying every reference; the
    # migration scripts EF generates disable them too.
    conn.execute("PRAGMA foreign_keys=OFF;")

    tables = [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name;"
        )
        if row[0] not in SKIP_TABLES
    ]

    filled, skipped = [], []
    for table in tables:
        all_cols, required = insertable_columns(conn, table)
        # Every column first, so the row exercises as much of the migration as possible; the
        # required-only retry is for a CHECK constraint the generic value doesn't satisfy.
        for candidate in (all_cols, required):
            try:
                with conn:
                    insert_row(conn, table, candidate)
                filled.append(table)
                break
            except sqlite3.Error as err:
                last_error = err
        else:
            skipped.append(f"{table} ({last_error})")

    conn.close()

    print(f"[fixture] filled {len(filled)}/{len(tables)} tables: {', '.join(filled)}")
    if skipped:
        # Not fatal: a table nobody could populate still leaves the rest of the check useful,
        # but it is a hole in the coverage and should be visible in the log.
        print(f"[fixture] WARNING could not populate: {'; '.join(skipped)}")


if __name__ == "__main__":
    main()
