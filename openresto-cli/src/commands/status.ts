import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";

/**
 * Server state, as opposed to `auth whoami`'s key identity — two questions a script asks for
 * different reasons, so they stay two commands rather than one that answers both.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description(
      "Today's covers, booking totals, paused locations and schedule conflicts",
    )
    .action(
      handle(async (_options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get("/api/admin/overview");
        printResult(result, Boolean(globals.json));
      }),
    );
}
