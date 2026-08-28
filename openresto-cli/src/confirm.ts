import { createInterface } from "node:readline/promises";

export class ConfirmationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmationRequiredError";
  }
}

export interface ConfirmDeps {
  isTTY?: boolean;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
}

/**
 * Gates a destructive command: `--yes` always proceeds; otherwise an interactive TTY is prompted
 * y/N; a non-interactive session (piped input, CI) with no `--yes` is refused rather than
 * silently blocking on a prompt nobody can answer.
 */
export async function confirmOrExit(
  message: string,
  yes: boolean,
  deps: ConfirmDeps = {},
): Promise<void> {
  if (yes) {
    return;
  }

  const isTTY = deps.isTTY ?? Boolean(process.stdin.isTTY);
  if (!isTTY) {
    throw new ConfirmationRequiredError(
      `${message} Re-run with --yes to confirm (required when not running in a terminal).`,
    );
  }

  const rl = createInterface({
    input: deps.stdin ?? process.stdin,
    output: deps.stdout ?? process.stdout,
  });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) {
      throw new ConfirmationRequiredError("Aborted: not confirmed.");
    }
  } finally {
    rl.close();
  }
}
