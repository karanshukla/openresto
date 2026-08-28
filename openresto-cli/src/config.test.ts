import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadConfigFile,
  saveConfigFile,
  resolveProfile,
  upsertProfile,
  clearProfileKey,
  DEFAULT_PROFILE_NAME,
  configPath,
  type ConfigFile,
} from "./config.js";

// config.ts reads/writes ~/.config/openresto via HOME/USERPROFILE-derived homedir(); redirect it
// to a scratch dir for the duration of each test so nothing touches the real user config.
function withScratchHome<T>(fn: () => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), "openresto-cli-test-"));
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = dir;
  process.env.USERPROFILE = dir;
  try {
    return fn();
  } finally {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("config file read/write", () => {
  test("loadConfigFile returns an empty profile map when no file exists", () => {
    withScratchHome(() => {
      const config = loadConfigFile();
      assert.deepEqual(config, { profiles: {} });
    });
  });

  test("saveConfigFile then loadConfigFile round-trips profiles", () => {
    withScratchHome(() => {
      const config: ConfigFile = {
        profiles: { work: { url: "https://a.example", apiKey: "k1" } },
      };
      saveConfigFile(config);

      const reloaded = loadConfigFile();

      assert.deepEqual(reloaded, config);
    });
  });

  test("saveConfigFile writes the file at mode 0600", () => {
    withScratchHome(() => {
      saveConfigFile({ profiles: {} });

      const stat = statSync(configPath());
      assert.equal(stat.mode & 0o777, 0o600);
    });
  });

  test("loadConfigFile throws a readable error on invalid JSON", () => {
    withScratchHome(() => {
      mkdirSync(path.dirname(configPath()), { recursive: true });
      writeFileSync(configPath(), "not json");

      assert.throws(() => loadConfigFile(), /not valid JSON/);
    });
  });

  test("upsertProfile adds a profile without disturbing others", () => {
    withScratchHome(() => {
      upsertProfile("a", { url: "https://a.example", apiKey: "ka" });
      upsertProfile("b", { url: "https://b.example", apiKey: "kb" });

      const config = loadConfigFile();

      assert.equal(config.profiles.a?.url, "https://a.example");
      assert.equal(config.profiles.b?.url, "https://b.example");
    });
  });

  test("clearProfileKey removes the API key but keeps the URL", () => {
    withScratchHome(() => {
      upsertProfile("work", { url: "https://a.example", apiKey: "secret" });

      clearProfileKey("work");

      const config = loadConfigFile();
      assert.equal(config.profiles.work?.url, "https://a.example");
      assert.equal(config.profiles.work?.apiKey, undefined);
    });
  });

  test("clearProfileKey on an unknown profile is a no-op, not a throw", () => {
    withScratchHome(() => {
      assert.doesNotThrow(() => clearProfileKey("nope"));
    });
  });
});

describe("resolveProfile precedence", () => {
  test("falls back to the default profile name when none is given", () => {
    const resolved = resolveProfile({
      env: {},
      config: {
        profiles: { [DEFAULT_PROFILE_NAME]: { url: "https://stored.example" } },
      },
    });

    assert.equal(resolved.profileName, DEFAULT_PROFILE_NAME);
    assert.equal(resolved.url, "https://stored.example");
  });

  test("uses the named profile when --profile is given", () => {
    const resolved = resolveProfile({
      profileName: "staging",
      env: {},
      config: {
        profiles: { staging: { url: "https://staging.example", apiKey: "sk" } },
      },
    });

    assert.equal(resolved.url, "https://staging.example");
    assert.equal(resolved.apiKey, "sk");
  });

  test("OPENRESTO_URL overrides the stored profile's URL", () => {
    const resolved = resolveProfile({
      env: { OPENRESTO_URL: "https://env.example" },
      config: { profiles: { default: { url: "https://stored.example" } } },
    });

    assert.equal(resolved.url, "https://env.example");
    assert.equal(resolved.fromEnv.url, true);
  });

  test("OPENRESTO_API_KEY overrides the stored profile's key", () => {
    const resolved = resolveProfile({
      env: { OPENRESTO_API_KEY: "env-key" },
      config: {
        profiles: {
          default: { url: "https://stored.example", apiKey: "stored-key" },
        },
      },
    });

    assert.equal(resolved.apiKey, "env-key");
    assert.equal(resolved.fromEnv.apiKey, true);
  });

  test("env URL and stored API key can combine independently", () => {
    const resolved = resolveProfile({
      env: { OPENRESTO_URL: "https://env.example" },
      config: {
        profiles: {
          default: { url: "https://stored.example", apiKey: "stored-key" },
        },
      },
    });

    assert.equal(resolved.url, "https://env.example");
    assert.equal(resolved.apiKey, "stored-key");
    assert.equal(resolved.fromEnv.url, true);
    assert.equal(resolved.fromEnv.apiKey, false);
  });

  test("OPENRESTO_PROFILE selects the profile when --profile is not passed", () => {
    const resolved = resolveProfile({
      env: { OPENRESTO_PROFILE: "ci" },
      config: { profiles: { ci: { url: "https://ci.example" } } },
    });

    assert.equal(resolved.profileName, "ci");
    assert.equal(resolved.url, "https://ci.example");
  });

  test("an unknown profile resolves to an empty URL rather than throwing", () => {
    const resolved = resolveProfile({
      profileName: "ghost",
      env: {},
      config: { profiles: {} },
    });

    assert.equal(resolved.url, "");
    assert.equal(resolved.apiKey, undefined);
  });
});
