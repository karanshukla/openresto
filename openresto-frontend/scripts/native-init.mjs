#!/usr/bin/env node
/**
 * Generates a self-hoster's native build configuration from their running instance.
 * See scripts/lib/native-init.mjs for what it writes and docs/native-app.md for the walkthrough.
 *
 *   npm run native:init -- --server https://bookings.example.com --bundle-id com.example.bistro
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./lib/native-init.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

run({ argv: process.argv.slice(2), root, fetch: globalThis.fetch, log: console.log }).catch(
  (err) => {
    console.error(err.message);
    process.exit(1);
  }
);
