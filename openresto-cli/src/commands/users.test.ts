import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import { registerUsersCommands } from "./users.js";

function usersCommand(): Command {
  const program = new Command();
  program.exitOverride();
  registerUsersCommands(program);
  const users = program.commands.find((c) => c.name() === "users");
  assert.ok(users);
  return users;
}

describe("users command surface", () => {
  /**
   * Creating an account, changing a role and resetting a password all hand out or move
   * interactive privilege, so the server refuses them to any API-key session, and a key is the
   * only credential this CLI has. Offering them would be offering three commands that can only
   * ever return 403 — and re-adding one would be re-opening the escalation path out of a key's
   * scopes into the full admin UI.
   */
  test("offers no verb that would hand out or move interactive privilege", () => {
    const names = usersCommand()
      .commands.map((c) => c.name())
      .sort();

    assert.deepEqual(names, ["activate", "deactivate", "list"]);
  });

  /**
   * The other half of that boundary: what is left must still be there. Listing needs
   * `users:read`, activation `users:write`, and neither grants a session.
   */
  test("still reaches the account reads and activation a key may perform", () => {
    const names = usersCommand().commands.map((c) => c.name());

    assert.ok(names.includes("list"));
    assert.ok(names.includes("activate"));
    assert.ok(names.includes("deactivate"));
  });

  /**
   * The rule `auth login` follows for the API key, held across this whole command group: a secret
   * passed as an argument is visible to every other process on the host through `ps`. No verb here
   * takes one, and none may grow one.
   */
  test("offers no flag anywhere that would put a password in argv", () => {
    const flags = usersCommand()
      .commands.flatMap((c) => c.options.map((o) => o.flags))
      .join(" ");

    assert.doesNotMatch(flags, /password/i);
  });
});
