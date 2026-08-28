#!/usr/bin/env node
// Regenerates src/generated/api.d.ts from the backend's committed OpenAPI document
// (openresto-cli/openapi/v1.json — see OpenRestoApi.csproj's comment and
// tools/OpenApiExport for how that file itself gets produced).
//
// This is the ONLY generated artifact: it types the shape of requests/responses for the
// hand-written fetch transport (src/transport.ts) to lean on, but generated operation/method
// names never dictate the CLI's command structure — see openresto-cli/README.md.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const input = path.join(root, "openapi", "v1.json");
const output = path.join(root, "src", "generated", "api.d.ts");
const bin = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "openapi-typescript.cmd" : "openapi-typescript",
);

execFileSync(bin, [input, "-o", output], { stdio: "inherit" });
