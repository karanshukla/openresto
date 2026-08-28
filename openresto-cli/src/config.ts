import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export interface Profile {
  url: string;
  apiKey?: string;
}

export interface ConfigFile {
  profiles: Record<string, Profile>;
}

export const DEFAULT_PROFILE_NAME = "default";

/** `~/.config/openresto/config.json` — mode 0600, one JSON object of named profiles. */
export function configDir(): string {
  return path.join(homedir(), ".config", "openresto");
}

export function configPath(): string {
  return path.join(configDir(), "config.json");
}

export function loadConfigFile(): ConfigFile {
  const file = configPath();
  if (!existsSync(file)) {
    return { profiles: {} };
  }
  const raw = readFileSync(file, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<ConfigFile>;
    return { profiles: parsed.profiles ?? {} };
  } catch {
    throw new Error(`Config file at ${file} is not valid JSON.`);
  }
}

/** Writes the config file at mode 0600. Overwrites the whole file — callers read-modify-write. */
export function saveConfigFile(config: ConfigFile): void {
  const dir = configDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const file = configPath();
  const json = JSON.stringify(config, null, 2) + "\n";
  writeFileSync(file, json, { mode: 0o600 });
  // writeFileSync's mode is only applied when the file is created; force it on every save so an
  // existing world/group-readable file (e.g. created by an older version) gets tightened too.
  chmodSync(file, 0o600);
}

export interface ResolvedProfile {
  profileName: string;
  url: string;
  apiKey?: string;
  /** True when the URL and/or key came from OPENRESTO_URL/OPENRESTO_API_KEY rather than the
   * config file — env always wins over a stored profile. */
  fromEnv: { url: boolean; apiKey: boolean };
}

export interface ResolveOptions {
  profileName?: string;
  env?: NodeJS.ProcessEnv;
  config?: ConfigFile;
}

/**
 * Resolves the effective server URL + API key for a profile: env vars
 * (`OPENRESTO_URL`/`OPENRESTO_API_KEY`) beat whatever is stored for the profile, field by field —
 * a caller can override just the key (e.g. a CI secret) while still using the config file's URL.
 */
export function resolveProfile(options: ResolveOptions = {}): ResolvedProfile {
  const env = options.env ?? process.env;
  const config = options.config ?? loadConfigFile();
  const profileName =
    options.profileName ?? env.OPENRESTO_PROFILE ?? DEFAULT_PROFILE_NAME;
  const stored = config.profiles[profileName];

  const envUrl = env.OPENRESTO_URL;
  const envKey = env.OPENRESTO_API_KEY;

  const url = envUrl ?? stored?.url ?? "";
  const apiKey = envKey ?? stored?.apiKey;

  return {
    profileName,
    url,
    apiKey,
    fromEnv: { url: envUrl !== undefined, apiKey: envKey !== undefined },
  };
}

export function upsertProfile(name: string, profile: Profile): ConfigFile {
  const config = loadConfigFile();
  config.profiles[name] = profile;
  saveConfigFile(config);
  return config;
}

/** Removes just the stored API key for a profile (used by `auth logout`), keeping the URL. */
export function clearProfileKey(name: string): ConfigFile {
  const config = loadConfigFile();
  const existing = config.profiles[name];
  if (existing) {
    delete existing.apiKey;
  }
  saveConfigFile(config);
  return config;
}
