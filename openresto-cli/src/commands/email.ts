import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";

const FAILURE_COLUMNS = [
  "id",
  "attemptedAt",
  "bookingRef",
  "recipientEmail",
  "errorMessage",
];

/**
 * Read-only by design: the SMTP credentials are unreachable with an API key, so there is no
 * `email set` to pair with these. What a script needs is the answer to "are my guests receiving
 * anything", which booking confirmations never report — they are best-effort server-side and
 * never block a booking.
 */
export function registerEmailCommands(program: Command): void {
  const email = program
    .command("email")
    .description("Check outgoing email configuration and delivery failures");

  email
    .command("status")
    .description(
      "Whether outgoing email is configured and confirmations are on",
    )
    .action(
      handle(async (_options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get("/api/admin/email-settings/status");
        printResult(result, Boolean(globals.json));
      }),
    );

  email
    .command("failures")
    .description(
      "Recent booking confirmations that failed to send. The recipient comes back blank " +
        "for a key without the guests:read scope.",
    )
    .action(
      handle(async (_options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get("/api/admin/email-settings/failures");
        printResult(result, Boolean(globals.json), FAILURE_COLUMNS);
      }),
    );
}
