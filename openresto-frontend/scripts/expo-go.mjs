#!/usr/bin/env node
/**
 * Starts Metro for testing the guest app in Expo Go on a phone.
 * See scripts/lib/expo-go.mjs for how the API base is resolved and docs/native-app.md.
 *
 *   npm run native:go
 *   npm run native:go -- --host 192.168.1.42 --port 5062
 */
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import {
  USAGE,
  checkBackend,
  parseArgs,
  pickLanAddress,
  probeRouteAddress,
  resolveApiUrl,
  resolvePort,
  unreachableHelp,
} from "./lib/expo-go.mjs";

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

const lanAddress = pickLanAddress(networkInterfaces(), await probeRouteAddress());
const apiUrl = resolveApiUrl({ options, env: process.env, lanAddress });

console.log(`Guest app → ${apiUrl}`);
const reachable = await checkBackend(apiUrl, globalThis.fetch);
if (!reachable.ok) {
  console.log("");
  console.log(reachable.reason);
  console.log(unreachableHelp(resolvePort(options.port)));
}
console.log("");
console.log("Scan the QR code below with Expo Go. Press w for the browser, r to reload.");
console.log("");

const child = spawn("npx", ["expo", "start", "--lan", ...options.expoArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
