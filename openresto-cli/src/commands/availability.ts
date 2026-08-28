import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";

export function registerAvailabilityCommands(program: Command): void {
  const availability = program
    .command("availability")
    .description("Check table availability");

  availability
    .command("check")
    .description(
      "Available slots for a location/date/party size (public endpoint)",
    )
    .requiredOption("--location <id>", "Restaurant/location id", Number)
    .requiredOption("--date <date>", "Date to check (ISO 8601)")
    .requiredOption("--seats <n>", "Party size", Number)
    .action(
      handle(
        async (
          options: { location: number; date: string; seats: number },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.get(
            `/api/restaurants/${options.location}/availability`,
            { query: { date: options.date, seats: options.seats } },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
    );
}
