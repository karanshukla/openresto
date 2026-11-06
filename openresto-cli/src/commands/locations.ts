import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";
import { confirmOrExit } from "../confirm.js";
import { ApiError, type Client } from "../transport.js";

const LIST_COLUMNS = [
  "id",
  "name",
  "isArchived",
  "activeBookingsCount",
  "upcomingBookingsCount",
];

const CONFLICT_COLUMNS = [
  "bookingId",
  "bookingRef",
  "date",
  "seats",
  "customerName",
  "reason",
];

const DATE_EXCEPTION_COLUMNS = ["date", "type", "open", "close", "lastBooking"];

interface PauseResponse {
  message: string;
  bookingsPausedUntil: string;
}

interface DateExceptionRecord {
  date: string;
  type: string;
  open?: string | null;
  close?: string | null;
  lastBooking?: string | null;
}

interface OnlineLimits {
  maxBookingDaysAhead?: number | null;
  minBookingNoticeMinutes?: number | null;
  minOnlinePartySize?: number | null;
  maxOnlinePartySize?: number | null;
}

interface LocationRecord extends OnlineLimits {
  name: string;
  address?: string | null;
  maxTableOversizeSeats?: number | null;
  maxCoversPerSlot?: number | null;
  dateExceptions?: DateExceptionRecord[] | null;
}

interface LimitFlags {
  maxDaysAhead?: string;
  minNotice?: string;
  minParty?: string;
  maxParty?: string;
}

const DATE_EXCEPTION_TYPES: Record<string, string> = {
  closed: "closed",
  "special-hours": "specialHours",
  "walk-in-only": "walkInOnly",
};

const SPECIAL_HOURS_TYPE = "specialHours";

export function registerLocationsCommands(program: Command): void {
  const locations = program
    .command("locations")
    .description("Manage restaurant locations");

  locations
    .command("list")
    .description("List locations, including archived ones (admin view)")
    .action(
      handle(async (_options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get("/api/admin/restaurants");
        printResult(result, Boolean(globals.json), LIST_COLUMNS);
      }),
    );

  locations
    .command("get <id>")
    .description(
      "Show full details for one location (public view — archived locations 404)",
    )
    .action(
      handle(async (id: string, _options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get(
          `/api/restaurants/${encodeURIComponent(id)}`,
        );
        printResult(result, Boolean(globals.json));
      }),
    );

  locations
    .command("create")
    .description("Create a new location")
    .requiredOption("--name <name>", "Location name")
    .option("--address <address>", "Street address")
    .action(
      handle(
        async (
          options: { name: string; address?: string },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.post("/api/admin/restaurants", {
            body: { name: options.name, address: options.address },
          });
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  locations
    .command("pause <id>")
    .description(
      "Pause new bookings that would start within the next N minutes, or for the rest of " +
        "today's service. Give exactly one of --minutes and --rest-of-today.",
    )
    .option("--minutes <n>", "How many minutes ahead to close", Number)
    .option(
      "--rest-of-today",
      "Pause until today's service ends (the current or next service, in the location's timezone)",
    )
    .action(
      handle(
        async (
          id: string,
          options: { minutes?: number; restOfToday?: boolean },
          command: Command,
        ) => {
          const body = pauseBody(options);
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.post<PauseResponse>(
            `/api/admin/restaurants/${encodeURIComponent(id)}/pause`,
            { body },
          );
          if (globals.json) {
            printResult(result, true);
            return;
          }
          console.log(
            `Location ${id} paused until ${result.bookingsPausedUntil} (UTC).`,
          );
        },
      ),
    );

  locations
    .command("unpause <id>")
    .description("Lift an active booking pause")
    .action(
      handle(async (id: string, _options: unknown, command: Command) => {
        const { client } = clientFor(command);
        await client.post(
          `/api/admin/restaurants/${encodeURIComponent(id)}/unpause`,
        );
        console.log(`Location ${id} unpaused.`);
      }),
    );

  locations
    .command("extend <id>")
    .description(
      'Push every active booking at a location out by N minutes ("we\'re running late tonight")',
    )
    .requiredOption("--minutes <n>", "Minutes to add to each end time", Number)
    .action(
      handle(
        async (id: string, options: { minutes: number }, command: Command) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.post(
            `/api/admin/restaurants/${encodeURIComponent(id)}/extend`,
            { body: { minutes: options.minutes } },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  locations
    .command("conflicts <id>")
    .description(
      "Bookings stranded by a narrowed schedule — taken under hours or open days the location " +
        "no longer runs. Editing the schedule leaves existing bookings alone by design.",
    )
    .action(
      handle(async (id: string, _options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get(
          `/api/restaurants/${encodeURIComponent(id)}/schedule-conflicts`,
        );
        printResult(result, Boolean(globals.json), CONFLICT_COLUMNS);
      }),
    );

  locations
    .command("update <id>")
    .description(
      "Set the online booking limits: how far ahead guests may book, the least notice they " +
        "must give, and the smallest and largest party that may book online. Pass `none` to " +
        "clear a limit. Other settings are left as they are.",
    )
    .option(
      "--max-days-ahead <n|none>",
      "Days ahead guests may book (0 is today only)",
    )
    .option(
      "--min-notice <minutes|none>",
      "Least notice an online booking must give",
    )
    .option("--min-party <n|none>", "Smallest party that may book online")
    .option("--max-party <n|none>", "Largest party that may book online")
    .action(
      handle(async (id: string, options: LimitFlags, command: Command) => {
        const limits = limitsFrom(options);
        if (Object.keys(limits).length === 0) {
          throw new Error(
            "Nothing to change. Pass at least one of --max-days-ahead, --min-notice, --min-party, --max-party.",
          );
        }
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const current = await fetchLocation(client, id);
        const result = await client.put<LocationRecord>(
          `/api/restaurants/${encodeURIComponent(id)}`,
          { body: { ...carriedFields(current), ...limits } },
        );
        printResult(
          globals.json ? result : pickLimits(result),
          Boolean(globals.json),
        );
      }),
    );

  const dates = locations
    .command("dates")
    .description(
      "Dates that depart from the weekly schedule: closed, special hours, or walk-in only",
    );

  dates
    .command("list <id>")
    .description("List a location's date exceptions")
    .action(
      handle(async (id: string, _options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const current = await fetchLocation(client, id);
        printResult(
          current.dateExceptions ?? [],
          Boolean(globals.json),
          DATE_EXCEPTION_COLUMNS,
        );
      }),
    );

  dates
    .command("add <id>")
    .description(
      "Add a date exception, replacing any entry already on that date. Special hours need " +
        "--open and --close; --last-booking is the latest start inside them.",
    )
    .requiredOption("--date <YYYY-MM-DD>", "The local calendar date")
    .requiredOption("--type <type>", "closed | special-hours | walk-in-only")
    .option("--open <HH:mm>", "Opening time (special hours only)")
    .option("--close <HH:mm>", "Closing time (special hours only)")
    .option(
      "--last-booking <HH:mm>",
      "Latest booking start (special hours only; default: up to close)",
    )
    .action(
      handle(
        async (
          id: string,
          options: {
            date: string;
            type: string;
            open?: string;
            close?: string;
            lastBooking?: string;
          },
          command: Command,
        ) => {
          const entry = dateExceptionFrom(options);
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const current = await fetchLocation(client, id);
          const kept = (current.dateExceptions ?? []).filter(
            (e) => e.date !== entry.date,
          );
          const result = await client.put<LocationRecord>(
            `/api/restaurants/${encodeURIComponent(id)}`,
            {
              body: {
                ...carriedFields(current),
                dateExceptions: [...kept, entry],
              },
            },
          );
          printResult(
            result.dateExceptions ?? [],
            Boolean(globals.json),
            DATE_EXCEPTION_COLUMNS,
          );
        },
      ),
    );

  dates
    .command("remove <id>")
    .description("Remove the date exception on one date")
    .requiredOption("--date <YYYY-MM-DD>", "The local calendar date")
    .action(
      handle(
        async (id: string, options: { date: string }, command: Command) => {
          const date = parseExceptionDate(options.date);
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const current = await fetchLocation(client, id);
          const existing = current.dateExceptions ?? [];
          if (!existing.some((e) => e.date === date)) {
            throw new Error(`Location ${id} has no date exception on ${date}.`);
          }
          const result = await client.put<LocationRecord>(
            `/api/restaurants/${encodeURIComponent(id)}`,
            {
              body: {
                ...carriedFields(current),
                dateExceptions: existing.filter((e) => e.date !== date),
              },
            },
          );
          printResult(
            result.dateExceptions ?? [],
            Boolean(globals.json),
            DATE_EXCEPTION_COLUMNS,
          );
        },
      ),
    );

  locations
    .command("archive <id>")
    .description("Archive a location (delists it; required before delete)")
    .action(
      handle(async (id: string, _options: unknown, command: Command) => {
        const { client } = clientFor(command);
        await client.patch(`/api/admin/restaurants/${encodeURIComponent(id)}`, {
          body: { isArchived: true },
        });
        console.log(`Location ${id} archived.`);
      }),
    );

  locations
    .command("restore <id>")
    .description(
      "Restore an archived location — no confirmation needed, this is reversible",
    )
    .action(
      handle(async (id: string, _options: unknown, command: Command) => {
        const { client } = clientFor(command);
        await client.patch(`/api/admin/restaurants/${encodeURIComponent(id)}`, {
          body: { isArchived: false },
        });
        console.log(`Location ${id} restored.`);
      }),
    );

  locations
    .command("delete <id>")
    .description(
      "Permanently delete an archived location and everything under it — cannot be undone. " +
        "The server rejects this unless the location is already archived.",
    )
    .option("--yes", "Skip the confirmation prompt")
    .action(
      handle(
        async (id: string, options: { yes?: boolean }, command: Command) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);

          let confirmMessage = `This will permanently delete location ${id} and everything under it.`;
          try {
            const preview = await client.get<{
              name: string;
              sectionCount: number;
              tableCount: number;
              bookingCount: number;
            }>(
              `/api/admin/restaurants/${encodeURIComponent(id)}/delete-preview`,
            );
            confirmMessage =
              `This will permanently delete "${preview.name}" (${preview.sectionCount} section(s), ` +
              `${preview.tableCount} table(s), ${preview.bookingCount} booking(s)).`;
          } catch {
            // Preview is best-effort — fall back to the generic message rather than blocking delete.
          }

          await confirmOrExit(
            confirmMessage,
            Boolean(options.yes ?? globals.yes),
          );

          try {
            await client.delete(
              `/api/admin/restaurants/${encodeURIComponent(id)}`,
            );
          } catch (err) {
            if (err instanceof ApiError && err.status === 400) {
              throw new Error(
                `${err.message} Archive the location first with "locations archive ${id}".`,
              );
            }
            throw err;
          }
          console.log(`Location ${id} deleted.`);
        },
      ),
    );
}

function pauseBody(options: {
  minutes?: number;
  restOfToday?: boolean;
}): { minutes: number } | { until: "endOfService" } {
  const hasMinutes = options.minutes !== undefined;
  if (hasMinutes === Boolean(options.restOfToday)) {
    throw new Error("Give exactly one of --minutes <n> and --rest-of-today.");
  }
  if (options.restOfToday) {
    return { until: "endOfService" };
  }
  if (!Number.isInteger(options.minutes) || (options.minutes as number) < 1) {
    throw new Error("--minutes must be a whole number of 1 or more.");
  }
  return { minutes: options.minutes as number };
}

async function fetchLocation(
  client: Client,
  id: string,
): Promise<LocationRecord> {
  return client.get<LocationRecord>(
    `/api/restaurants/${encodeURIComponent(id)}`,
  );
}

/**
 * `PUT /api/restaurants/{id}` reads most fields as "null means unchanged", but assigns these
 * unconditionally, so a body that leaves one out clears it on the server. Every read-modify-write
 * in this file sends the fetched values back for exactly this set.
 *
 * @see [locations.test.ts](./locations.test.ts) — pins that `update` and `dates` send the
 * fetched address and caps back untouched.
 */
function carriedFields(current: LocationRecord): Record<string, unknown> {
  return {
    name: current.name,
    address: current.address ?? null,
    maxTableOversizeSeats: current.maxTableOversizeSeats ?? null,
    maxCoversPerSlot: current.maxCoversPerSlot ?? null,
    ...pickLimits(current),
  };
}

function pickLimits(record: OnlineLimits): Required<OnlineLimits> {
  return {
    maxBookingDaysAhead: record.maxBookingDaysAhead ?? null,
    minBookingNoticeMinutes: record.minBookingNoticeMinutes ?? null,
    minOnlinePartySize: record.minOnlinePartySize ?? null,
    maxOnlinePartySize: record.maxOnlinePartySize ?? null,
  };
}

function limitsFrom(flags: LimitFlags): OnlineLimits {
  const limits: OnlineLimits = {};
  if (flags.maxDaysAhead !== undefined) {
    limits.maxBookingDaysAhead = parseLimit(
      "--max-days-ahead",
      flags.maxDaysAhead,
    );
  }
  if (flags.minNotice !== undefined) {
    limits.minBookingNoticeMinutes = parseLimit(
      "--min-notice",
      flags.minNotice,
    );
  }
  if (flags.minParty !== undefined) {
    limits.minOnlinePartySize = parseLimit("--min-party", flags.minParty);
  }
  if (flags.maxParty !== undefined) {
    limits.maxOnlinePartySize = parseLimit("--max-party", flags.maxParty);
  }
  return limits;
}

function parseLimit(flag: string, raw: string): number | null {
  if (raw.trim().toLowerCase() === "none") {
    return null;
  }
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`${flag} must be a whole number, or "none" to clear it.`);
  }
  return Number(raw);
}

function dateExceptionFrom(options: {
  date: string;
  type: string;
  open?: string;
  close?: string;
  lastBooking?: string;
}): DateExceptionRecord {
  const date = parseExceptionDate(options.date);
  const type = DATE_EXCEPTION_TYPES[options.type.trim().toLowerCase()];
  if (!type) {
    throw new Error(
      `--type must be one of ${Object.keys(DATE_EXCEPTION_TYPES).join(", ")}.`,
    );
  }
  const hours = {
    open: parseTimeFlag("--open", options.open),
    close: parseTimeFlag("--close", options.close),
    lastBooking: parseTimeFlag("--last-booking", options.lastBooking),
  };
  if (type !== SPECIAL_HOURS_TYPE) {
    if (hours.open || hours.close || hours.lastBooking) {
      throw new Error(
        "--open, --close and --last-booking apply to --type special-hours only.",
      );
    }
    return { date, type };
  }
  if (!hours.open || !hours.close) {
    throw new Error("--type special-hours needs both --open and --close.");
  }
  return {
    date,
    type,
    open: hours.open,
    close: hours.close,
    ...(hours.lastBooking ? { lastBooking: hours.lastBooking } : {}),
  };
}

function parseExceptionDate(raw: string): string {
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("--date must be a calendar date as YYYY-MM-DD.");
  }
  return value;
}

function parseTimeFlag(
  flag: string,
  raw: string | undefined,
): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = raw.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(`${flag} must be a time as HH:mm.`);
  }
  return value;
}
