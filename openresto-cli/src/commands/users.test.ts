import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import { registerUsersCommands } from "./users.js";

function resetPasswordCommand(): Command {
  const program = new Command();
  program.exitOverride();
  registerUsersCommands(program);
  const users = program.commands.find((c) => c.name() === "users");
  assert.ok(users);
  const reset = users.commands.find((c) => c.name() === "reset-password");
  assert.ok(reset);
  return reset;
}

describe("users reset-password", () => {
  /**
   * The rule this pins is the same one `auth login` follows for the API key: a secret passed as
   * an argument is visible to every other process on the host through `ps`. The command reads
   * the password from a hidden prompt or from piped stdin instead, so there is deliberately no
   * flag to carry it.
   */
  test("offers no flag that would put the password in argv", () => {
    const flags = resetPasswordCommand()
      .options.map((o) => o.flags)
      .join(" ");

    assert.doesNotMatch(flags, /password/i);
  });

  test("takes the account id as an argument, so only the secret comes from stdin", () => {
    assert.match(resetPasswordCommand().usage(), /<id>/);
  });
});
