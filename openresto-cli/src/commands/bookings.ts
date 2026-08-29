import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";
import { confirmOrExit } from "../confirm.js";
import { omitUndefined, readTextInput } from "../io.js";
import { readAllStdin } from "../prompt.js";

const LIST_COLUMNS = [
  "id",
  "restaurantName",
  "date",
  "seats",
  "customerEmail",
  "status",
];

/**
 * `BookingDto` carries `isCancelled`, not a `status` string, so the table view derives one; the
 * `--json` output stays the raw DTO.
 */
function withDerivedStatus(result: unknown): unknown {
  if (!Array.isArray(result)) {
    return result;
  }
  return (result as Record<string, unknown>[]).map((row) => ({
    ...row,
    status: row.isCancelled ? "cancelled" : "active",
  }));
}

export function registerBookingsCommands(program: Command): void {
  const bookings = program.command("bookings").description("Manage bookings");

  bookings
    .command("list")
    .description("List bookings (admin view)")
    .option("--location <id>", "Filter by restaurant/location id", Number)
    .option("--date <date>", "Filter by date (ISO 8601)")
    .option(
      "--status <status>",
      "active | cancelled | all | past | upcoming (default: active)",
    )
    .option("--email <email>", "Filter by customer email")
    .option("--ref <bookingRef>", "Filter by booking reference")
    .option("--query <text>", "Free-text search")
    .action(
      handle(
        async (
          options: {
            location?: number;
            date?: string;
            status?: string;
            email?: string;
            ref?: string;
            query?: string;
          },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.get("/api/admin/bookings", {
            query: {
              restaurantId: options.location,
              date: options.date,
              status: options.status,
              email: options.email,
              bookingRef: options.ref,
              query: options.query,
            },
          });
          printResult(
            globals.json ? result : withDerivedStatus(result),
            Boolean(globals.json),
            LIST_COLUMNS,
          );
        },
      ),
    );

  bookings
    .command("get <id>")
    .description("Show one booking")
    .action(
      handle(async (id: string, _options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get(
          `/api/admin/bookings/${encodeURIComponent(id)}`,
        );
        printResult(result, Boolean(globals.json));
      }),
    );

  bookings
    .command("create")
    .description("Record a walk-in/admin booking (no hold required)")
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .requiredOption("--section <id>", "Section id", Number)
    .requiredOption("--table <id>", "Table id", Number)
    .requiredOption("--date <date>", "Booking date/time (ISO 8601, UTC)")
    .requiredOption("--seats <n>", "Party size", Number)
    .requiredOption("--email <email>", "Customer email")
    .option("--name <name>", "Customer name")
    .action(
      handle(
        async (
          options: {
            location: number;
            section: number;
            table: number;
            date: string;
            seats: number;
            email: string;
            name?: string;
          },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.post("/api/admin/bookings", {
            body: {
              restaurantId: options.location,
              sectionId: options.section,
              tableId: options.table,
              date: options.date,
              seats: options.seats,
              customerEmail: options.email,
              customerName: options.name,
            },
          });
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  bookings
    .command("update <id>")
    .description("Update a booking's fields")
    .option("--location <id>", "Restaurant/location id", Number)
    .option("--section <id>", "Section id", Number)
    .option("--table <id>", "Table id", Number)
    .option("--date <date>", "Booking date/time (ISO 8601, UTC)")
    .option("--seats <n>", "Party size", Number)
    .option("--email <email>", "Customer email")
    .option("--name <name>", "Customer name")
    .option("--notes <text>", "Special requests")
    .action(
      handle(
        async (
          id: string,
          options: {
            location?: number;
            section?: number;
            table?: number;
            date?: string;
            seats?: number;
            email?: string;
            name?: string;
            notes?: string;
          },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const body = omitUndefined({
            restaurantId: options.location,
            sectionId: options.section,
            tableId: options.table,
            date: options.date,
            seats: options.seats,
            customerEmail: options.email,
            customerName: options.name,
            specialRequests: options.notes,
          });
          const result = await client.put(
            `/api/admin/bookings/${encodeURIComponent(id)}`,
            {
              body,
            },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  bookings
    .command("cancel <id>")
    .description("Cancel a booking")
    .action(
      handle(async (id: string, _options: unknown, command: Command) => {
        const { client } = clientFor(command);
        await client.post(
          `/api/admin/bookings/${encodeURIComponent(id)}/cancel`,
        );
        console.log(`Booking ${id} cancelled.`);
      }),
    );

  bookings
    .command("restore <id>")
    .description("Restore a cancelled booking")
    .action(
      handle(async (id: string, _options: unknown, command: Command) => {
        const { client } = clientFor(command);
        await client.post(
          `/api/admin/bookings/${encodeURIComponent(id)}/restore`,
        );
        console.log(`Booking ${id} restored.`);
      }),
    );

  bookings
    .command("extend <id>")
    .description("Push one booking's end time out by N minutes")
    .requiredOption("--minutes <n>", "Minutes to add to the end time", Number)
    .action(
      handle(
        async (id: string, options: { minutes: number }, command: Command) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.post(
            `/api/admin/bookings/${encodeURIComponent(id)}/extend`,
            { body: { minutes: options.minutes } },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  bookings
    .command("email <id>")
    .description(
      "Email the guest on a booking. The body is read from --body-file, or from stdin when " +
        "that is piped — never a flag, since a message is multi-line.",
    )
    .requiredOption("--subject <subject>", "Subject line")
    .option(
      "--body-file <path>",
      "File holding the message body, or - to read stdin",
    )
    .action(
      handle(
        async (
          id: string,
          options: { subject: string; bodyFile?: string },
          command: Command,
        ) => {
          const body = await readEmailBody(options.bodyFile);
          if (!body.trim()) {
            throw new Error("The email body is empty.");
          }
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.post(
            `/api/admin/bookings/${encodeURIComponent(id)}/email`,
            { body: { subject: options.subject, body } },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  bookings
    .command("purge <id>")
    .description("Permanently delete a booking (GDPR purge) — cannot be undone")
    .option("--yes", "Skip the confirmation prompt")
    .action(
      handle(
        async (id: string, options: { yes?: boolean }, command: Command) => {
          const globals = getGlobalOptions(command);
          await confirmOrExit(
            `This will permanently delete booking ${id}.`,
            Boolean(options.yes ?? globals.yes),
          );
          const { client } = clientFor(command);
          await client.delete(`/api/admin/bookings/${encodeURIComponent(id)}`);
          console.log(`Booking ${id} purged.`);
        },
      ),
    );
}

/**
 * Refuses rather than blocking on a prompt nobody can answer: with no `--body-file` and an
 * interactive terminal there is nothing to read, and waiting on stdin would look like a hang.
 */
async function readEmailBody(bodyFile: string | undefined): Promise<string> {
  if (bodyFile) {
    return readTextInput(bodyFile);
  }
  if (process.stdin.isTTY) {
    throw new Error(
      "No message body. Pass --body-file <path>, or pipe the body into stdin.",
    );
  }
  return readAllStdin();
}
