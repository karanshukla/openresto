/**
 * Generates the per-publisher files a self-hoster's native build of the guest app needs
 * (issue #388), from the instance the app will talk to. Everything it writes lands in one
 * gitignored directory — `native/` by default — which `app.config.ts` reads at build time:
 *
 *   app.native.json                           name, colour, ids, deep-link host, EAS project
 *   icon-ios.png                              1024×1024, opaque (what App Store Connect accepts)
 *   icon-android-foreground.png               432×432 adaptive-icon foreground layer
 *   .well-known/apple-app-site-association    Universal Links, when --apple-team-id is given
 *   .well-known/assetlinks.json               App Links, when --android-fingerprint is given
 *
 * The icons come from the instance's own brand settings (`GET /api/brand/app-icon-*.png`);
 * `--icon` / `--android-foreground` substitute real artwork. Nothing here is a secret — the
 * two .well-known files are meant to be served publicly — but every value is one publisher's,
 * which is why the directory is generated rather than committed.
 *
 * Pure functions only: the CLI entry is scripts/native-init.mjs. Tested by
 * tests/scripts/native-init.test.ts.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const CONFIG_FILE = "app.native.json";
export const IOS_ICON_FILE = "icon-ios.png";
export const ANDROID_FOREGROUND_FILE = "icon-android-foreground.png";
export const WELL_KNOWN_DIR = ".well-known";
export const AASA_FILE = "apple-app-site-association";
export const ASSETLINKS_FILE = "assetlinks.json";

/**
 * The guest routes a tapped link should open in the app rather than the browser. `/` is
 * deliberately absent so the home page keeps opening in the browser, and so `/admin` and
 * `/api` never match.
 */
export const GUEST_LINK_PATHS = [
  "/lookup",
  "/booking-confirmation",
  "/locations",
  "/restaurant",
  "/book",
  "/search",
];

export const IOS_ICON_ENDPOINT = "/api/brand/app-icon-ios.png";
export const ANDROID_FOREGROUND_ENDPOINT = "/api/brand/app-icon-android-foreground.png";

const FLAGS = {
  server: "string",
  "bundle-id": "string",
  package: "string",
  name: "string",
  slug: "string",
  scheme: "string",
  "project-id": "string",
  owner: "string",
  "apple-team-id": "string",
  "android-fingerprint": "list",
  icon: "string",
  "android-foreground": "string",
  out: "string",
  help: "boolean",
};

export const USAGE = `Usage: npm run native:init -- --server <url> --bundle-id <id> [options]

Required the first time (remembered in native/app.native.json afterwards):
  --server <url>               Your OpenResto instance, e.g. https://bookings.example.com
  --bundle-id <id>             iOS bundle identifier, e.g. com.example.bistro

Options:
  --package <id>               Android application id (default: same as --bundle-id)
  --name <text>                App name (default: the instance's brand name)
  --slug <text>                EAS project slug (default: derived from the name)
  --scheme <text>              Custom URL scheme (default: derived from the slug)
  --project-id <uuid>          EAS project id, from \`eas init\`
  --owner <account>            EAS account or organisation that owns the project
  --apple-team-id <id>         Writes .well-known/apple-app-site-association for Universal Links
  --android-fingerprint <sha>  Signing cert SHA-256; repeatable. Writes .well-known/assetlinks.json
  --icon <file>                1024×1024 opaque PNG to use instead of the generated iOS icon
  --android-foreground <file>  432×432 PNG to use instead of the generated adaptive foreground
  --out <dir>                  Output directory (default: native)
  --help

See docs/native-app.md for the full walkthrough.`;

export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument "${arg}".\n\n${USAGE}`);
    const eq = arg.indexOf("=");
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const kind = FLAGS[key];
    if (!kind) throw new Error(`Unknown option "--${key}".\n\n${USAGE}`);
    if (kind === "boolean") {
      options[key] = true;
      continue;
    }
    const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Option "--${key}" needs a value.\n\n${USAGE}`);
    }
    if (kind === "list") (options[key] ??= []).push(value);
    else options[key] = value;
  }
  return options;
}

/** Lower-case, hyphen-separated, ASCII only: what EAS accepts as a slug. */
export function deriveSlug(name) {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "openresto";
}

/** A URL scheme is letters and digits, starting with a letter. */
export function deriveScheme(slug) {
  const scheme = slug.toLowerCase().replace(/[^a-z0-9]/g, "");
  return /^[a-z]/.test(scheme) ? scheme : `app${scheme}`;
}

const APP_ID = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

export function assertAppId(id, flag) {
  if (!APP_ID.test(id)) {
    throw new Error(
      `--${flag} "${id}" must be reverse-DNS: two or more dot-separated segments, each starting with a letter (e.g. com.example.bistro).`
    );
  }
  return id;
}

export function normalizeServerUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`--server "${raw}" is not a URL.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`--server must be an http(s) URL, got "${raw}".`);
  }
  if (url.protocol === "http:" && url.hostname !== "localhost") {
    throw new Error(
      `--server "${raw}" is plain http. Store builds need https — iOS blocks cleartext by default and Universal Links require it.`
    );
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
}

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function normalizeFingerprint(raw) {
  const upper = raw.trim().toUpperCase();
  const withColons = upper.includes(":") ? upper : (upper.match(/.{1,2}/g) ?? []).join(":");
  if (!FINGERPRINT.test(withColons)) {
    throw new Error(
      `--android-fingerprint "${raw}" is not a SHA-256 fingerprint (32 colon-separated hex bytes, as \`eas credentials\` or \`keytool -list\` print it).`
    );
  }
  return withColons;
}

/**
 * Merges what the self-hoster passed over what a previous run wrote, so a re-run to add
 * `--project-id` or a fingerprint does not need every original flag again.
 */
export function buildNativeConfig(existing, options, brand) {
  const serverUrl = options.server ? normalizeServerUrl(options.server) : existing?.serverUrl;
  if (!serverUrl) throw new Error(`--server is required.\n\n${USAGE}`);

  const bundleIdentifier = options["bundle-id"]
    ? assertAppId(options["bundle-id"], "bundle-id")
    : existing?.bundleIdentifier;
  if (!bundleIdentifier) throw new Error(`--bundle-id is required.\n\n${USAGE}`);

  const androidPackage = options.package
    ? assertAppId(options.package, "package")
    : (existing?.androidPackage ?? bundleIdentifier);

  const name = options.name ?? existing?.name ?? brand.appName;
  const slug = options.slug ?? existing?.slug ?? deriveSlug(name);
  const scheme = options.scheme ?? existing?.scheme ?? deriveScheme(slug);
  const fingerprints = options["android-fingerprint"]
    ? options["android-fingerprint"].map(normalizeFingerprint)
    : existing?.androidFingerprints;

  return {
    serverUrl,
    name,
    slug,
    scheme,
    primaryColor: brand.primaryColor,
    bundleIdentifier,
    androidPackage,
    linkPaths: GUEST_LINK_PATHS,
    ...pick("easProjectId", options["project-id"] ?? existing?.easProjectId),
    ...pick("easOwner", options.owner ?? existing?.easOwner),
    ...pick("appleTeamId", options["apple-team-id"] ?? existing?.appleTeamId),
    ...pick("androidFingerprints", fingerprints),
  };
}

function pick(key, value) {
  return value === undefined ? {} : { [key]: value };
}

/**
 * Apple's file has no extension and must be served as application/json; the nginx image
 * does that for the whole /.well-known/ path. Paths use Apple's `*` glob, so `/lookup*`
 * covers `/lookup?ref=…`, which is what the confirmation email links to.
 */
export function buildAasa(config) {
  return {
    applinks: {
      details: [
        {
          appIDs: [`${config.appleTeamId}.${config.bundleIdentifier}`],
          components: [
            { "/": "/admin/*", exclude: true },
            { "/": "/api/*", exclude: true },
            ...config.linkPaths.map((path) => ({ "/": `${path}*` })),
          ],
        },
      ],
    },
  };
}

export function buildAssetLinks(config) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: config.androidPackage,
        sha256_cert_fingerprints: config.androidFingerprints,
      },
    },
  ];
}

export async function fetchBrand(serverUrl, fetchImpl) {
  const url = `${serverUrl}/api/brand`;
  let response;
  try {
    response = await fetchImpl(url);
  } catch (err) {
    throw new Error(`Could not reach ${url}: ${err.message}`);
  }
  if (!response.ok) {
    throw new Error(
      `${url} answered ${response.status}. Is that the public address of your OpenResto instance?`
    );
  }
  const brand = await response.json();
  return {
    appName: brand.appName || "Open Resto",
    primaryColor: brand.primaryColor || "#0a7ea4",
    hasIcon: Boolean(brand.faviconIcon),
  };
}

async function downloadIcon(serverUrl, endpoint, dest, fetchImpl) {
  const response = await fetchImpl(`${serverUrl}${endpoint}`);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`${serverUrl}${endpoint} answered ${response.status}.`);
  writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return true;
}

function readExisting(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

/**
 * Runs the whole generation. `root` is the frontend project directory; `fetch` and `log`
 * are injected so the tests never touch the network.
 */
export async function run({ argv, root, fetch: fetchImpl, log }) {
  const options = parseArgs(argv);
  if (options.help) {
    log(USAGE);
    return null;
  }

  const outDir = resolve(root, options.out ?? "native");
  const configFile = join(outDir, CONFIG_FILE);
  const existing = readExisting(configFile);
  const serverUrl = options.server ? normalizeServerUrl(options.server) : existing?.serverUrl;
  if (!serverUrl) throw new Error(`--server is required.\n\n${USAGE}`);

  const iconJobs = [
    [IOS_ICON_FILE, IOS_ICON_ENDPOINT, options.icon],
    [ANDROID_FOREGROUND_FILE, ANDROID_FOREGROUND_ENDPOINT, options["android-foreground"]],
  ].map(([file, endpoint, override]) => ({
    file,
    endpoint,
    source: override ? resolve(root, override) : undefined,
  }));
  for (const { source } of iconJobs) {
    if (source && !existsSync(source)) throw new Error(`Icon file not found: ${source}`);
  }

  const brand = await fetchBrand(serverUrl, fetchImpl);
  const config = buildNativeConfig(existing, options, brand);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");
  log(`Wrote ${configFile}`);

  const written = { icons: [], missingIcons: [], wellKnown: [] };
  for (const { file, endpoint, source } of iconJobs) {
    const dest = join(outDir, file);
    if (source) {
      copyFileSync(source, dest);
      written.icons.push(file);
    } else if (await downloadIcon(serverUrl, endpoint, dest, fetchImpl)) {
      written.icons.push(file);
    } else if (existsSync(dest)) {
      written.icons.push(file);
    } else {
      written.missingIcons.push(file);
    }
  }
  for (const file of written.icons) log(`Wrote ${join(outDir, file)}`);

  const wellKnownDir = join(outDir, WELL_KNOWN_DIR);
  if (config.appleTeamId) {
    mkdirSync(wellKnownDir, { recursive: true });
    writeFileSync(join(wellKnownDir, AASA_FILE), JSON.stringify(buildAasa(config), null, 2) + "\n");
    written.wellKnown.push(AASA_FILE);
  }
  if (config.androidFingerprints?.length) {
    mkdirSync(wellKnownDir, { recursive: true });
    writeFileSync(
      join(wellKnownDir, ASSETLINKS_FILE),
      JSON.stringify(buildAssetLinks(config), null, 2) + "\n"
    );
    written.wellKnown.push(ASSETLINKS_FILE);
  }
  for (const file of written.wellKnown) log(`Wrote ${join(wellKnownDir, file)}`);

  log("");
  log(nextSteps(config, written));
  return { config, outDir, written };
}

export function nextSteps(config, written) {
  const lines = [
    `${config.name} → ${config.serverUrl}`,
    `  iOS ${config.bundleIdentifier} · Android ${config.androidPackage} · scheme ${config.scheme}://`,
    "",
  ];
  if (written.missingIcons.length) {
    lines.push(
      "No brand icon is configured on the server, so the build will use OpenResto's bundled artwork.",
      "Pick one under Admin → Settings → Brand and re-run, or pass --icon and --android-foreground.",
      ""
    );
  }
  lines.push("Next:");
  if (!config.easProjectId) {
    lines.push(
      "  1. npx eas-cli init            # creates your EAS project; then re-run with --project-id <id>"
    );
  }
  lines.push(
    "  2. npx eas-cli build --platform android --profile preview   # an .apk to try on a phone",
    "  3. npx eas-cli build --platform android --profile production # an .aab for Play Console"
  );
  if (!written.wellKnown.includes(ASSETLINKS_FILE)) {
    lines.push(
      "  4. Re-run with --android-fingerprint <sha256> (from `eas credentials`) to generate assetlinks.json"
    );
  }
  if (!written.wellKnown.includes(AASA_FILE)) {
    lines.push("  5. Re-run with --apple-team-id <id> to generate apple-app-site-association");
  }
  if (written.wellKnown.length) {
    lines.push(
      `  Copy ${WELL_KNOWN_DIR}/ to the server as well-known/ next to docker-compose.yml so nginx serves it.`
    );
  }
  return lines.join("\n");
}
