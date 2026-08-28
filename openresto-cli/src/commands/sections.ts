import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";
import { confirmOrExit } from "../confirm.js";

interface Section {
  id: number;
  name: string;
}

const LIST_COLUMNS = ["id", "name"];

/**
 * Sections hang off a restaurant (`RestaurantsController`'s `{id}/sections[/{sectionId}]`
 * routes), so every command here takes `--location`. `list` uses the lighter admin lookup
 * endpoint (id/name only) rather than `tables list`'s sections-with-tables shape — pair it with
 * `tables list --location <id>` when you need table detail per section too.
 */
export function registerSectionsCommands(program: Command): void {
  const sections = program
    .command("sections")
    .description("Manage a location's sections");

  sections
    .command("list")
    .description("List a location's sections")
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .action(
      handle(async (options: { location: number }, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get<Section[]>(
          `/api/admin/restaurants/${options.location}/sections`,
        );
        printResult(result, Boolean(globals.json), LIST_COLUMNS);
      }),
    );

  sections
    .command("create")
    .description("Add a section to a location")
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .requiredOption("--name <name>", "Section name")
    .action(
      handle(
        async (
          options: { location: number; name: string },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.post(
            `/api/restaurants/${options.location}/sections`,
            { body: { name: options.name } },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  sections
    .command("update <sectionId>")
    .description("Rename a section")
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .requiredOption("--name <name>", "New section name")
    .action(
      handle(
        async (
          sectionId: string,
          options: { location: number; name: string },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.put(
            `/api/restaurants/${options.location}/sections/${encodeURIComponent(sectionId)}`,
            { body: { name: options.name } },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  sections
    .command("delete <sectionId>")
    .description(
      "Remove a section — its tables go too; bookings referencing the section (or one of its " +
        "tables) keep their booking, losing only the section/table link",
    )
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .option("--yes", "Skip the confirmation prompt")
    .action(
      handle(
        async (
          sectionId: string,
          options: { location: number; yes?: boolean },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);

          let message = `This will remove section ${sectionId} and its tables.`;
          try {
            const impact = await client.get<{ bookings: number }>(
              `/api/restaurants/${options.location}/sections/${sectionId}/impact`,
            );
            if (impact.bookings > 0) {
              message += ` ${impact.bookings} upcoming booking(s) will lose their section reference.`;
            }
          } catch {
            // Best-effort preview only.
          }

          await confirmOrExit(message, Boolean(options.yes ?? globals.yes));
          await client.delete(
            `/api/restaurants/${options.location}/sections/${encodeURIComponent(sectionId)}`,
          );
          console.log(`Section ${sectionId} removed.`);
        },
      ),
    );
}
