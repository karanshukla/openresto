import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";
import { confirmOrExit } from "../confirm.js";

interface Table {
  id: number;
  name: string | null;
  seats: number;
}
interface Section {
  id: number;
  name: string;
  tables: Table[];
}

const LIST_COLUMNS = [
  "sectionId",
  "sectionName",
  "tableId",
  "tableName",
  "seats",
];

/**
 * Tables and sections share one CRUD surface server-side (`RestaurantsController`'s
 * `{id}/sections/{sectionId}/tables/{tableId}` routes) — a table cannot be created, updated, or
 * deleted without naming the section it lives in. Rather than build a parallel `sections` command
 * group, `tables list` prints the section id/name alongside each table so `--section` has
 * something to point at; full section CRUD (rename, reorder, delete) is left to the admin UI.
 */
export function registerTablesCommands(program: Command): void {
  const tables = program
    .command("tables")
    .description("Manage tables (grouped by section)");

  tables
    .command("list")
    .description("List a location's sections and tables")
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .action(
      handle(async (options: { location: number }, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const sections = await client.get<Section[]>(
          `/api/admin/restaurants/${options.location}/tables`,
        );
        const rows = sections.flatMap<Record<string, unknown>>((section) =>
          section.tables.length > 0
            ? section.tables.map((table) => ({
                sectionId: section.id,
                sectionName: section.name,
                tableId: table.id,
                tableName: table.name,
                seats: table.seats,
              }))
            : [
                {
                  sectionId: section.id,
                  sectionName: section.name,
                  tableId: "",
                  tableName: "(no tables)",
                  seats: "",
                },
              ],
        );
        printResult(
          globals.json ? sections : rows,
          Boolean(globals.json),
          LIST_COLUMNS,
        );
      }),
    );

  tables
    .command("create")
    .description("Add a table to a section")
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .requiredOption("--section <id>", "Section id (see `tables list`)", Number)
    .requiredOption("--seats <n>", "Seat count", Number)
    .option("--name <name>", "Table name/number")
    .action(
      handle(
        async (
          options: {
            location: number;
            section: number;
            seats: number;
            name?: string;
          },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.post(
            `/api/restaurants/${options.location}/sections/${options.section}/tables`,
            { body: { name: options.name, seats: options.seats } },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  tables
    .command("update <tableId>")
    .description("Rename a table or change its seat count")
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .requiredOption("--section <id>", "Section id (see `tables list`)", Number)
    .requiredOption("--seats <n>", "Seat count", Number)
    .option("--name <name>", "Table name/number")
    .action(
      handle(
        async (
          tableId: string,
          options: {
            location: number;
            section: number;
            seats: number;
            name?: string;
          },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.put(
            `/api/restaurants/${options.location}/sections/${options.section}/tables/${encodeURIComponent(tableId)}`,
            { body: { name: options.name, seats: options.seats } },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  tables
    .command("delete <tableId>")
    .description(
      "Remove a table — bookings referencing it keep their booking, losing only the table link",
    )
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .requiredOption("--section <id>", "Section id (see `tables list`)", Number)
    .option("--yes", "Skip the confirmation prompt")
    .action(
      handle(
        async (
          tableId: string,
          options: { location: number; section: number; yes?: boolean },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);

          let message = `This will remove table ${tableId}.`;
          try {
            const impact = await client.get<{ bookings: number }>(
              `/api/restaurants/${options.location}/sections/${options.section}/tables/${tableId}/impact`,
            );
            if (impact.bookings > 0) {
              message += ` ${impact.bookings} upcoming booking(s) will lose their table reference.`;
            }
          } catch {
            // Best-effort preview only.
          }

          await confirmOrExit(message, Boolean(options.yes ?? globals.yes));
          await client.delete(
            `/api/restaurants/${options.location}/sections/${options.section}/tables/${encodeURIComponent(tableId)}`,
          );
          console.log(`Table ${tableId} removed.`);
        },
      ),
    );
}
