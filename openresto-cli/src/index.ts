#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerBookingsCommands } from "./commands/bookings.js";
import { registerAvailabilityCommands } from "./commands/availability.js";
import { registerLocationsCommands } from "./commands/locations.js";
import { registerTablesCommands } from "./commands/tables.js";
import { registerBrandCommands } from "./commands/brand.js";
import { registerUsersCommands } from "./commands/users.js";
import { registerAuditCommands } from "./commands/audit.js";

const program = new Command();

program
  .name("openresto")
  .description("Command-line client for the OpenResto admin API")
  .version("0.1.0")
  .option("--profile <name>", 'Named profile to use (default: "default")')
  .option("--json", "Output raw JSON instead of a table")
  .option("--yes", "Skip confirmation prompts on destructive commands");

registerAuthCommands(program);
registerBookingsCommands(program);
registerAvailabilityCommands(program);
registerLocationsCommands(program);
registerTablesCommands(program);
registerBrandCommands(program);
registerUsersCommands(program);
registerAuditCommands(program);

await program.parseAsync(process.argv);
