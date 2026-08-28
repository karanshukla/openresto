import { Command } from "commander";
import {
  DEFAULT_PROFILE_NAME,
  clearProfileKey,
  upsertProfile,
} from "../config.js";
import { ApiError, Client } from "../transport.js";
import { promptHidden, promptText, readAllStdin } from "../prompt.js";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";
import { getCliVersion } from "../version.js";
import { warnOnServerVersionMismatch } from "../versionCheck.js";

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage saved server URL + API key profiles");

  auth
    .command("login")
    .description(
      "Save a server URL and API key as a profile. Prompts interactively, or reads the key " +
        "from stdin when piped — never pass the key as an argument.",
    )
    .option(
      "--url <url>",
      "Server URL (e.g. https://booking.example.com). Prompted if omitted.",
    )
    .action(
      handle(async (options: { url?: string }, command: Command) => {
        const globals = getGlobalOptions(command);
        const profileName = globals.profile ?? DEFAULT_PROFILE_NAME;

        const url = options.url ?? (await promptText("Server URL"));
        if (!url) {
          throw new Error("A server URL is required.");
        }

        const apiKey = process.stdin.isTTY
          ? await promptHidden("API key")
          : await readAllStdin();
        if (!apiKey) {
          throw new Error("An API key is required.");
        }

        const client = new Client({ baseUrl: url, apiKey });
        try {
          await client.get("/api/admin/api-keys/self");
        } catch (err) {
          if (err instanceof ApiError) {
            throw new Error(
              `Could not verify the API key against ${url}: ${err.message}`,
            );
          }
          throw err;
        }

        upsertProfile(profileName, { url, apiKey });
        console.log(`Saved profile "${profileName}" for ${url}.`);
        await warnOnServerVersionMismatch(client, getCliVersion());
      }),
    );

  auth
    .command("whoami")
    .description("Show the identity and scopes of the active profile's API key")
    .action(
      handle(async (_options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const self = await client.get("/api/admin/api-keys/self");
        printResult(self, Boolean(globals.json));
        await warnOnServerVersionMismatch(client, getCliVersion());
      }),
    );

  auth
    .command("logout")
    .description(
      "Remove the saved API key for the active profile (keeps the server URL)",
    )
    .action(
      handle(async (_options: unknown, command: Command) => {
        const globals = getGlobalOptions(command);
        const profileName = globals.profile ?? DEFAULT_PROFILE_NAME;
        clearProfileKey(profileName);
        console.log(`Removed the API key for profile "${profileName}".`);
      }),
    );
}
