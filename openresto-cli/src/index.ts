#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerBookingsCommands } from "./commands/bookings.js";
import { registerAvailabilityCommands } from "./commands/availability.js";
import { registerLocationsCommands } from "./commands/locations.js";
import { registerTablesCommands } from "./commands/tables.js";
import { registerSectionsCommands } from "./commands/sections.js";
import { registerBrandCommands } from "./commands/brand.js";
import { registerUsersCommands } from "./commands/users.js";
import { registerAuditCommands } from "./commands/audit.js";

// The CLI isn't its own product — it's versioned in lockstep with OpenResto (package.json's
// "version" is bumped alongside the root/frontend one on every release, per
// scripts/check-release-version.sh), so `--version` reads it from package.json rather than
// carrying a second hardcoded number that would drift.
const packageDir = path.dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(path.join(packageDir, "..", "package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("openresto")
  .description("Command-line client for the OpenResto admin API")
  .version(version)
  .option("--profile <name>", 'Named profile to use (default: "default")')
  .option("--json", "Output raw JSON instead of a table")
  .option("--yes", "Skip confirmation prompts on destructive commands");

registerAuthCommands(program);
registerBookingsCommands(program);
registerAvailabilityCommands(program);
registerLocationsCommands(program);
registerTablesCommands(program);
registerSectionsCommands(program);
registerBrandCommands(program);
registerUsersCommands(program);
registerAuditCommands(program);

await program.parseAsync(process.argv);
