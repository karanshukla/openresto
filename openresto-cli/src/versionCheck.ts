import { ApiError, type Client } from "./transport.js";

/**
 * The OpenResto release the CLI's own `/api/version` endpoint first shipped in (issue #404). A
 * self-hoster's server 404ing this request predates that release — the CLI has no way to learn
 * the server's actual version, only that it's older than this one.
 */
const VERSION_ENDPOINT_INTRODUCED_IN = "1.9.0";

interface VersionResponse {
  version: string;
}

/**
 * Compares the CLI's own version against the server's `GET /api/version`, major.minor only — a
 * patch delta is expected (self-hosters upgrade the two independently) and stays silent. Called
 * once, at `auth login` (after the key verifies) and `auth whoami`, never on every command: this
 * is one extra request purely to catch the case issue #404 exists for — a self-hoster running an
 * old server against a new CLI — so a mismatch prints a warning and nothing else. It is always
 * advisory: a network failure, a mismatch, or a 404 from a server old enough to predate this
 * endpoint must never fail the command it's attached to, so every path here only ever writes to
 * stderr and returns.
 */
export async function warnOnServerVersionMismatch(
  client: Client,
  cliVersion: string,
): Promise<void> {
  let response: VersionResponse;
  try {
    response = await client.get<VersionResponse>("/api/version", {
      anonymous: true,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(
        `warning: server version is unknown (older than ${VERSION_ENDPOINT_INTRODUCED_IN}, ` +
          `/api/version not found) — commands may not match the server's API`,
      );
    }
    return;
  }

  const server = majorMinor(response.version);
  const cli = majorMinor(cliVersion);
  if (!server || !cli) {
    return;
  }

  if (server.major !== cli.major || server.minor !== cli.minor) {
    console.error(
      `warning: server is ${response.version}, CLI is ${cliVersion} — commands may not match ` +
        "the server's API",
    );
  }
}

function majorMinor(
  version: string,
): { major: number; minor: number } | undefined {
  const match = /^(\d+)\.(\d+)/.exec(version);
  if (!match) {
    return undefined;
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}
