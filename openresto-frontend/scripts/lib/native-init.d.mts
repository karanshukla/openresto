/** Types for the ESM generator so tests/scripts/native-init.test.ts type-checks against it. */
export interface BrandSummary {
  appName: string;
  primaryColor: string;
  hasIcon: boolean;
}

export interface NativeInitConfig {
  serverUrl: string;
  name: string;
  slug: string;
  scheme: string;
  primaryColor: string;
  bundleIdentifier: string;
  androidPackage: string;
  linkPaths: string[];
  easProjectId?: string;
  easOwner?: string;
  appleTeamId?: string;
  androidFingerprints?: string[];
}

export interface ParsedOptions {
  server?: string;
  "bundle-id"?: string;
  package?: string;
  name?: string;
  slug?: string;
  scheme?: string;
  "project-id"?: string;
  owner?: string;
  "apple-team-id"?: string;
  "android-fingerprint"?: string[];
  icon?: string;
  "android-foreground"?: string;
  out?: string;
  help?: boolean;
}

export interface Written {
  icons: string[];
  missingIcons: string[];
  wellKnown: string[];
}

export interface RunResult {
  config: NativeInitConfig;
  outDir: string;
  written: Written;
}

export const CONFIG_FILE: string;
export const IOS_ICON_FILE: string;
export const ANDROID_FOREGROUND_FILE: string;
export const WELL_KNOWN_DIR: string;
export const AASA_FILE: string;
export const ASSETLINKS_FILE: string;
export const GUEST_LINK_PATHS: string[];
export const IOS_ICON_ENDPOINT: string;
export const ANDROID_FOREGROUND_ENDPOINT: string;
export const USAGE: string;

export function parseArgs(argv: string[]): ParsedOptions;
export function deriveSlug(name: string): string;
export function deriveScheme(slug: string): string;
export function assertAppId(id: string, flag: string): string;
export function normalizeServerUrl(raw: string): string;
export function normalizeFingerprint(raw: string): string;
export function buildNativeConfig(
  existing: Partial<NativeInitConfig> | null,
  options: ParsedOptions,
  brand: BrandSummary
): NativeInitConfig;
export function buildAasa(config: NativeInitConfig): unknown;
export function buildAssetLinks(config: NativeInitConfig): unknown;
export function fetchBrand(
  serverUrl: string,
  fetchImpl: (url: string) => Promise<Response>
): Promise<BrandSummary>;
export function nextSteps(config: NativeInitConfig, written: Written): string;
export function run(args: {
  argv: string[];
  root: string;
  fetch: (url: string) => Promise<Response>;
  log: (line: string) => void;
}): Promise<RunResult | null>;
