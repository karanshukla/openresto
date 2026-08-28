import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";
import { confirmOrExit } from "../confirm.js";
import { ApiError } from "../transport.js";

const LIST_COLUMNS = [
  "id",
  "name",
  "isArchived",
  "activeBookingsCount",
  "upcomingBookingsCount",
];

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
      "Pause new bookings that would start within the next N minutes",
    )
    .requiredOption("--minutes <n>", "How many minutes ahead to close", Number)
    .action(
      handle(
        async (id: string, options: { minutes: number }, command: Command) => {
          const { client } = clientFor(command);
          await client.post(
            `/api/admin/restaurants/${encodeURIComponent(id)}/pause`,
            {
              body: { minutes: options.minutes },
            },
          );
          console.log(
            `Location ${id} paused for ${options.minutes} minute(s).`,
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
