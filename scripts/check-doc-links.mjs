#!/usr/bin/env node
// Fails when a code comment points at a test that no longer exists. The comment
// policy in CLAUDE.md lets a test carry a business rule in place of prose, which
// only holds while the link resolves.
//
// Two forms are checked: the TypeScript JSDoc "see" tag followed by a markdown
// link to a relative path, and the C# `<seealso>` tag naming a test method,
// which must match a method declared by a class in OpenRestoApi.Tests.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_PROJECT = join(REPO_ROOT, "OpenRestoApi.Tests");

const SKIP_DIRS = new Set([
  "node_modules",
  "bin",
  "obj",
  "dist",
  "build",
  "coverage",
  "coverage-report",
  "coverage-report-seeder",
  "test-results",
  "playwright-report",
  "Migrations",
]);

const TS_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full));
    } else {
      found.push(full);
    }
  }
  return found;
}

function fileExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// A markdown link after the tag, plus the bare relative-path form.
const TS_MARKDOWN_LINK = /@see\s+\[[^\]]+\]\(([^)]+)\)/g;
const TS_BARE_LINK = /@see\s+((?:\.{1,2}\/)[^\s)]+)/g;
const CS_SEEALSO = /<seealso>([^<]+)<\/seealso>/g;
const CS_CLASS_DECL = /^\s*(?:public|internal|sealed|static|abstract|partial|\s)*class\s+([A-Za-z0-9_]+)/gm;
const CS_METHOD_DECL = /^\s*(?:public|private|internal|protected|static|async|override|virtual|sealed|\s)+[A-Za-z0-9_<>,.\[\]?]+\s+([A-Za-z0-9_]+)\s*\(/gm;

function checkTypeScript(files) {
  const failures = [];

  for (const file of files) {
    if (!TS_EXTENSIONS.some((ext) => file.endsWith(ext))) continue;

    const source = readFileSync(file, "utf8");
    const targets = new Set();

    for (const [, target] of source.matchAll(TS_MARKDOWN_LINK)) targets.add(target);
    for (const [, target] of source.matchAll(TS_BARE_LINK)) targets.add(target);

    for (const target of targets) {
      if (/^[a-z]+:\/\//.test(target) || target.startsWith("#")) continue;

      const resolved = resolve(dirname(file), target.split("#")[0]);
      if (!fileExists(resolved)) {
        failures.push(`${relative(REPO_ROOT, file)} -> ${target} (no such file)`);
      }
    }
  }

  return failures;
}

function indexTestMethods() {
  const methodsByClass = new Map();

  for (const file of walk(TEST_PROJECT)) {
    if (!file.endsWith(".cs")) continue;

    const source = readFileSync(file, "utf8");
    const classNames = [...source.matchAll(CS_CLASS_DECL)].map(([, name]) => name);
    if (classNames.length === 0) continue;

    const methodNames = new Set([...source.matchAll(CS_METHOD_DECL)].map(([, name]) => name));
    for (const className of classNames) {
      const known = methodsByClass.get(className) ?? new Set();
      for (const method of methodNames) known.add(method);
      methodsByClass.set(className, known);
    }
  }

  return methodsByClass;
}

function checkCSharp(files) {
  const methodsByClass = indexTestMethods();
  const allMethods = new Set([...methodsByClass.values()].flatMap((names) => [...names]));
  const failures = [];

  for (const file of files) {
    if (!file.endsWith(".cs")) continue;
    if (file.startsWith(TEST_PROJECT)) continue;

    for (const [, target] of readFileSync(file, "utf8").matchAll(CS_SEEALSO)) {
      const reference = target.trim();
      const [className, methodName] = reference.includes(".")
        ? reference.split(".")
        : [null, reference];

      if (className === null) {
        if (!allMethods.has(methodName)) {
          failures.push(`${relative(REPO_ROOT, file)} -> ${reference} (no test declares it)`);
        }
        continue;
      }

      const known = methodsByClass.get(className);
      if (!known) {
        failures.push(`${relative(REPO_ROOT, file)} -> ${reference} (no such test class)`);
      } else if (!known.has(methodName)) {
        failures.push(`${relative(REPO_ROOT, file)} -> ${reference} (no such test method)`);
      }
    }
  }

  return failures;
}

const files = walk(REPO_ROOT);
const failures = [...checkTypeScript(files), ...checkCSharp(files)];

if (failures.length > 0) {
  console.error(`Broken doc links (${failures.length}):\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("\nEvery link must resolve, or the rule it points at is undocumented again.");
  process.exit(1);
}

console.log("All doc links resolve.");
