import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";

const LIST_COLUMNS = ["id", "email", "displayName", "role", "isActive"];

/**
 * Owner-only server-side (an API key needs `users:*` scope, minted only by an Owner account).
 * A non-Owner key gets a 403 here, surfaced by the shared error handler like any other request.
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
    .command("create")
    .description("Create a new admin account")
    .requiredOption("--email <email>", "Account email")
    .requiredOption("--password <password>", "Initial password")
    .requiredOption("--role <role>", "Owner or Manager")
    .option("--display-name <name>", "Display name")
    .action(
      handle(
        async (
          options: {
            email: string;
            password: string;
            role: string;
            displayName?: string;
          },
          command: Command,
        ) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.post("/api/admin/users", {
            body: {
              email: options.email,
              password: options.password,
              role: options.role,
              displayName: options.displayName,
            },
          });
          printResult(result, Boolean(globals.json));
        },
      ),
    );

  users
    .command("role <id>")
    .description("Change an account's role")
    .requiredOption("--role <role>", "Owner or Manager")
    .action(
      handle(
        async (id: string, options: { role: string }, command: Command) => {
          const { client } = clientFor(command);
          const globals = getGlobalOptions(command);
          const result = await client.patch(
            `/api/admin/users/${encodeURIComponent(id)}/role`,
            {
              body: { role: options.role },
            },
          );
          printResult(result, Boolean(globals.json));
        },
      ),
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
