import { createInterface } from "node:readline/promises";

/** Plain-text prompt (used for the server URL). */
export async function promptText(
  message: string,
  deps: { stdin?: NodeJS.ReadableStream; stdout?: NodeJS.WritableStream } = {},
): Promise<string> {
  const rl = createInterface({
    input: deps.stdin ?? process.stdin,
    output: deps.stdout ?? process.stdout,
  });
  try {
    return (await rl.question(`${message}: `)).trim();
  } finally {
    rl.close();
  }
}

export interface HiddenPromptDeps {
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
}

/**
 * Reads a line from stdin without echoing it — used for the API key so it never lands in shell
 * history or a terminal scrollback. Requires an interactive TTY (raw mode); callers should use
 * {@link readAllStdin} instead when stdin is piped.
 */
export function promptHidden(
  message: string,
  deps: HiddenPromptDeps = {},
): Promise<string> {
  const stdin = deps.stdin ?? process.stdin;
  const stdout = deps.stdout ?? process.stdout;

  return new Promise((resolve, reject) => {
    stdout.write(`${message}: `);

    const wasRaw = stdin.isRaw ?? false;
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";

    const cleanup = () => {
      if (stdin.setRawMode) {
        stdin.setRawMode(wasRaw);
      }
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "") {
          // Ctrl+C
          cleanup();
          reject(new Error("Aborted."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (char === "" || char === "\b") {
          // Backspace
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.on("data", onData);
  });
}

/** Reads all of stdin to completion — used when the API key is piped rather than typed. */
export async function readAllStdin(
  stream: NodeJS.ReadableStream = process.stdin,
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}
