import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";

const LIST_COLUMNS = ["id", "email", "displayName", "role", "isActive"];

/**
 * Owner-only server-side (an API key needs `users:*` scope, minted only by an Owner account).
 * A non-Owner key gets a 403 here, surfaced by the shared error handler like any other request.
 *
 * Deliberately no create, role or reset-password verb. Those three hand out or move interactive
 * privilege, so the server refuses them to any API-key session outright (`[NoApiKeyAccess]` on
 * `UsersController`), and an API key is the only credential this CLI has. Offering a command that
 * can only ever return 403 would be worse than not offering it. Listing and activation remain,
 * because neither grants a session.
 */
export function registerUsersCommands(program: Command): void {
  const users = program
    .command("users")
    .description("Manage admin accounts (Owner-only)");

  users
    .command("list")
    .description("List admin accounts")
    .action(
      handle(async (_options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get("/api/admin/users");
        printResult(result, Boolean(globals.json), LIST_COLUMNS);
      }),
    );

  users
    .command("activate <id>")
    .description("Reactivate a deactivated account")
    .action(handle(setActive(true)));

  users
    .command("deactivate <id>")
    .description("Deactivate an account (cannot deactivate your own)")
    .action(handle(setActive(false)));
}

function setActive(isActive: boolean) {
  return async (id: string, _options: unknown, command: Command) => {
    const { client } = clientFor(command);
    const globals = getGlobalOptions(command);
    const result = await client.patch(
      `/api/admin/users/${encodeURIComponent(id)}/active`,
      {
        body: { isActive },
      },
    );
    printResult(result, Boolean(globals.json));
  };
}
