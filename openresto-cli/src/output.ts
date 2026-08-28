/** Table/JSON rendering shared by every command. */

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/** Renders an array of flat-ish objects as a padded, column-aligned table. Falls back to JSON for
 * anything that isn't a non-empty array of objects (a single record, a scalar, an empty list). */
export function printTable(data: unknown, columns?: string[]): void {
  if (!Array.isArray(data)) {
    printRecord(data);
    return;
  }
  if (data.length === 0) {
    console.log("(no results)");
    return;
  }

  const rows = data as Record<string, unknown>[];
  const cols = columns ?? inferColumns(rows);
  const cells = rows.map((row) => cols.map((c) => formatCell(row[c])));
  const widths = cols.map((c, i) =>
    Math.max(c.length, ...cells.map((r) => r[i].length)),
  );

  const renderRow = (values: string[]) =>
    values
      .map((v, i) => v.padEnd(widths[i]))
      .join("  ")
      .trimEnd();

  console.log(renderRow(cols));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of cells) {
    console.log(renderRow(row));
  }
}

function printRecord(data: unknown): void {
  if (data === undefined || data === null) {
    console.log("(no content)");
    return;
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    console.log(String(data));
    return;
  }
  const entries = Object.entries(data as Record<string, unknown>);
  const width = Math.max(...entries.map(([k]) => k.length));
  for (const [key, value] of entries) {
    console.log(`${key.padEnd(width)}  ${formatCell(value)}`);
  }
}

function inferColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      seen.add(key);
    }
  }
  return [...seen];
}

function formatCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Dispatches to JSON or table rendering based on the shared `--json` flag. */
export function printResult(
  data: unknown,
  json: boolean,
  columns?: string[],
): void {
  if (json) {
    printJson(data);
  } else {
    printTable(data, columns);
  }
}
