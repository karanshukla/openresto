import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";

const LIST_COLUMNS = [
  "id",
  "createdAt",
  "actorDisplayName",
  "action",
  "targetType",
  "targetLabel",
  "summary",
];

interface AuditListOptions {
  actorUserId?: number;
  action?: string;
  targetType?: string;
  location?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function registerAuditCommands(program: Command): void {
  const audit = program
    .command("audit")
    .description("Read the admin activity trail (Owner-only)");

  audit
    .command("list")
    .description("List audit entries, newest first")
    .option("--actor-user-id <id>", "Filter by acting user id", Number)
    .option("--action <prefix>", "Filter by action prefix, e.g. booking")
    .option("--target-type <type>", "Filter by target type, e.g. Booking")
    .option("--location <id>", "Filter by restaurant/location id", Number)
    .option("--from <date>", "Only entries at/after this ISO date")
    .option("--to <date>", "Only entries at/before this ISO date")
    .option("--page <n>", "Page number (default 1)", Number)
    .option("--page-size <n>", "Page size (default 25)", Number)
    .action(
      handle(async (options: AuditListOptions, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get<{ items: unknown[] }>(
          "/api/admin/audit",
          {
            query: {
              actorUserId: options.actorUserId,
              action: options.action,
              targetType: options.targetType,
              restaurantId: options.location,
              from: options.from,
              to: options.to,
              page: options.page,
              pageSize: options.pageSize,
            },
          },
        );
        printResult(
          globals.json ? result : result.items,
          Boolean(globals.json),
          LIST_COLUMNS,
        );
      }),
    );
}
