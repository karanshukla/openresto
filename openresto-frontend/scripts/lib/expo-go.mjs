/**
 * Resolves the API base a phone running Expo Go should call, and starts Metro with it.
 *
 * The guest app reads `EXPO_PUBLIC_API_URL` at bundle time (see api/client.ts). `.env` sets it
 * to `http://localhost:8080`, which is right for web — the browser is on the same machine as
 * the backend — and useless on a phone, where `localhost` is the phone. So this resolves the
 * machine's LAN address instead and exports it before Metro starts; `@expo/env` leaves an
 * already-defined variable alone, so `.env` keeps serving the web workflow untouched.
 *
 * Pure functions only: the CLI entry is scripts/expo-go.mjs. Tested by
 * tests/scripts/expo-go.test.ts.
 */
import { createSocket } from "node:dgram";

export const DEFAULT_API_PORT = 8080;
export const HOST_ENV = "OPENRESTO_DEV_HOST";

export const USAGE = `Usage: npm run native:go -- [options] [-- expo start args]

Starts Metro for Expo Go with EXPO_PUBLIC_API_URL pointed at this machine's LAN address,
so the guest app on your phone reaches the backend instead of the phone's own localhost.

Options:
  --host <ip>    Address the phone should call (default: this machine's LAN address)
  --port <n>     Backend port (default: ${DEFAULT_API_PORT})
  --help

The phone and this machine must be on the same network, and the backend port must be open
through the firewall. See docs/native-app.md.`;

/**
 * Virtual adapters carry a private address that no phone can route to. On a Windows box with
 * WSL and Hyper-V installed there are usually more of these than real ones, so a "first
 * non-internal IPv4" pick lands on one of them roughly always.
 */
const VIRTUAL_INTERFACE =
  /^(vEthernet|WSL|Default Switch|Loopback|VirtualBox|VMware|Hyper-V|docker|br-|veth|utun|tun|tap)/i;

/**
 * The address the OS would use to reach the internet. A connected UDP socket sends nothing —
 * it only fixes the local end of the route — which is what makes this a reliable way to ask
 * the routing table which interface is the real one.
 */
export function probeRouteAddress() {
  return new Promise((resolve) => {
    const socket = createSocket("udp4");
    const done = (value) => {
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      resolve(value);
    };
    socket.once("error", () => done(undefined));
    try {
      socket.connect(53, "8.8.8.8", () => {
        try {
          done(socket.address().address);
        } catch {
          done(undefined);
        }
      });
    } catch {
      done(undefined);
    }
  });
}

/**
 * @see [expo-go.test.ts](../../tests/scripts/expo-go.test.ts) — pins that the routed address
 * wins, that a virtual adapter is never picked over a real one, and that an unroutable probe
 * result falls back to the interface list.
 */
export function pickLanAddress(interfaces, routed) {
  const candidates = [];
  for (const [name, addresses] of Object.entries(interfaces ?? {})) {
    for (const address of addresses ?? []) {
      if (address.internal || address.family !== "IPv4") continue;
      candidates.push({ name, address: address.address });
    }
  }
  if (routed && candidates.some((c) => c.address === routed)) return routed;
  return candidates.find((c) => !VIRTUAL_INTERFACE.test(c.name))?.address ?? candidates[0]?.address;
}

export function parseArgs(argv) {
  const options = { expoArgs: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      options.expoArgs.push(...argv.slice(i + 1));
      break;
    }
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    const match = /^--(host|port)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`Unknown option "${arg}".\n\n${USAGE}`);
    const value = match[2] ?? argv[++i];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Option "${match[1]}" needs a value.\n\n${USAGE}`);
    }
    options[match[1]] = value;
  }
  return options;
}

export function resolvePort(raw) {
  if (raw === undefined) return DEFAULT_API_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`--port "${raw}" is not a port number.`);
  }
  return port;
}

/**
 * `--host` beats the environment beats what the routing table says, so a machine whose real
 * address this cannot work out is still one flag away from a working session.
 */
export function resolveApiUrl({ options, env, lanAddress }) {
  const host = options.host ?? env[HOST_ENV] ?? lanAddress;
  if (!host) {
    throw new Error(
      `Could not work out this machine's LAN address. Pass --host <ip> (\`ipconfig\` on Windows, \`ifconfig\` elsewhere) or set ${HOST_ENV}.`
    );
  }
  return `http://${host}:${resolvePort(options.port)}`;
}

/**
 * A blocked firewall port and a stopped backend look identical from the phone — a spinner and
 * then a failed fetch — so the reachability of the address is reported here, before the QR
 * code, rather than being diagnosed on a phone screen.
 */
export async function checkBackend(apiUrl, fetchImpl) {
  try {
    const response = await fetchImpl(`${apiUrl}/api/brand`, { signal: AbortSignal.timeout(4000) });
    return response.ok
      ? { ok: true }
      : { ok: false, reason: `${apiUrl}/api/brand answered ${response.status}.` };
  } catch (err) {
    return { ok: false, reason: `${apiUrl}/api/brand is not reachable: ${err.message}` };
  }
}

export function unreachableHelp(port) {
  return [
    "The backend is not answering on that address. Usually one of:",
    "  • it is not running — `dotnet watch run` in OpenRestoApi, or `docker compose up`",
    `  • the firewall is blocking inbound ${port} (Windows: New-NetFirewallRule -DisplayName "OpenResto dev" -Direction Inbound -LocalPort ${port} -Protocol TCP -Action Allow)`,
    "  • the phone is on a different network, or the Wi-Fi has client isolation on",
    "",
    "Starting Metro anyway.",
  ].join("\n");
}
