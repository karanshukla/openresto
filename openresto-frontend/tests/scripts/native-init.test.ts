import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AASA_FILE,
  ANDROID_FOREGROUND_ENDPOINT,
  ANDROID_FOREGROUND_FILE,
  ASSETLINKS_FILE,
  CONFIG_FILE,
  GUEST_LINK_PATHS,
  IOS_ICON_ENDPOINT,
  IOS_ICON_FILE,
  WELL_KNOWN_DIR,
  assertAppId,
  buildAasa,
  buildAssetLinks,
  buildNativeConfig,
  deriveScheme,
  deriveSlug,
  fetchBrand,
  nextSteps,
  normalizeFingerprint,
  normalizeServerUrl,
  parseArgs,
  run,
} from "../../scripts/lib/native-init.mjs";
import {
  ANDROID_FOREGROUND_FILE as CONFIG_ANDROID_FOREGROUND_FILE,
  IOS_ICON_FILE as CONFIG_IOS_ICON_FILE,
  NATIVE_CONFIG_FILE,
  loadNativeConfig,
} from "../../app.config";

const brand = { appName: "Bistro Bookings", primaryColor: "#aa3311", hasIcon: true };
const FINGERPRINT =
  "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";

describe("parseArgs", () => {
  it("reads --key value and --key=value, and repeats list flags", () => {
    expect(
      parseArgs([
        "--server",
        "https://x.example",
        "--bundle-id=com.x.app",
        "--android-fingerprint",
        "a",
        "--android-fingerprint=b",
        "--help",
      ])
    ).toEqual({
      server: "https://x.example",
      "bundle-id": "com.x.app",
      "android-fingerprint": ["a", "b"],
      help: true,
    });
  });

  it("rejects unknown options, positional arguments and a flag without a value", () => {
    expect(() => parseArgs(["--nope", "x"])).toThrow('Unknown option "--nope"');
    expect(() => parseArgs(["positional"])).toThrow('Unexpected argument "positional"');
    expect(() => parseArgs(["--server"])).toThrow('"--server" needs a value');
    expect(() => parseArgs(["--server", "--name", "x"])).toThrow('"--server" needs a value');
  });
});

describe("derivations", () => {
  it("derives an EAS slug and a URL scheme from the brand name", () => {
    expect(deriveSlug("Café Émile & Sons!")).toBe("cafe-emile-sons");
    expect(deriveSlug("!!!")).toBe("openresto");
    expect(deriveScheme("cafe-emile-sons")).toBe("cafeemilesons");
    expect(deriveScheme("3-tables")).toBe("app3tables");
  });

  it("accepts reverse-DNS ids and rejects anything else", () => {
    expect(assertAppId("com.example.bistro", "bundle-id")).toBe("com.example.bistro");
    expect(assertAppId("com.example.bistro_2", "package")).toBe("com.example.bistro_2");
    expect(() => assertAppId("bistro", "bundle-id")).toThrow("--bundle-id");
    expect(() => assertAppId("com.1example.app", "package")).toThrow("--package");
  });

  it("normalises the server URL and refuses cleartext except localhost", () => {
    expect(normalizeServerUrl("https://bookings.example.com/")).toBe(
      "https://bookings.example.com"
    );
    expect(normalizeServerUrl("https://example.com/resto/")).toBe("https://example.com/resto");
    expect(normalizeServerUrl("http://localhost:5062")).toBe("http://localhost:5062");
    expect(() => normalizeServerUrl("http://bookings.example.com")).toThrow("plain http");
    expect(() => normalizeServerUrl("ftp://x")).toThrow("http(s)");
    expect(() => normalizeServerUrl("not a url")).toThrow("is not a URL");
  });

  it("normalises fingerprints to upper-case colon-separated bytes", () => {
    expect(normalizeFingerprint(FINGERPRINT.toLowerCase())).toBe(FINGERPRINT);
    expect(normalizeFingerprint(FINGERPRINT.replace(/:/g, ""))).toBe(FINGERPRINT);
    expect(() => normalizeFingerprint("AA:BB")).toThrow("SHA-256");
  });
});

describe("buildNativeConfig", () => {
  const options = parseArgs([
    "--server",
    "https://bookings.example.com",
    "--bundle-id",
    "com.x.app",
  ]);

  it("derives everything it can from the brand on a first run", () => {
    expect(buildNativeConfig(null, options, brand)).toEqual({
      serverUrl: "https://bookings.example.com",
      name: "Bistro Bookings",
      slug: "bistro-bookings",
      scheme: "bistrobookings",
      primaryColor: "#aa3311",
      bundleIdentifier: "com.x.app",
      androidPackage: "com.x.app",
      linkPaths: GUEST_LINK_PATHS,
    });
  });

  it("keeps a previous run's values so a re-run only needs the new flag", () => {
    const first = buildNativeConfig(null, options, brand);
    const second = buildNativeConfig(first, parseArgs(["--project-id", "p-1"]), brand);
    expect(second).toEqual({ ...first, easProjectId: "p-1" });
    const third = buildNativeConfig(
      second,
      parseArgs([
        "--android-fingerprint",
        FINGERPRINT,
        "--apple-team-id",
        "TEAM1",
        "--owner",
        "org",
      ]),
      brand
    );
    expect(third.androidFingerprints).toEqual([FINGERPRINT]);
    expect(third.appleTeamId).toBe("TEAM1");
    expect(third.easOwner).toBe("org");
    expect(third.easProjectId).toBe("p-1");
  });

  it("lets flags override both the brand and a previous run", () => {
    const config = buildNativeConfig(
      { name: "Old", slug: "old", scheme: "old" },
      parseArgs([
        ...["--server", "https://b.example", "--bundle-id", "com.x.app"],
        "--name",
        "New",
        "--package",
        "com.x.droid",
      ]),
      brand
    );
    expect(config.name).toBe("New");
    expect(config.slug).toBe("old");
    expect(config.androidPackage).toBe("com.x.droid");
  });

  it("requires server and bundle id when nothing was generated before", () => {
    expect(() => buildNativeConfig(null, parseArgs(["--bundle-id", "com.x.app"]), brand)).toThrow(
      "--server is required"
    );
    expect(() =>
      buildNativeConfig(null, parseArgs(["--server", "https://x.example"]), brand)
    ).toThrow("--bundle-id is required");
  });

  it("produces a config app.config.ts accepts", () => {
    const dir = mkdtempSync(join(tmpdir(), "native-init-"));
    try {
      writeFileSync(
        join(dir, NATIVE_CONFIG_FILE),
        JSON.stringify(buildNativeConfig(null, options, brand))
      );
      expect(loadNativeConfig(dir)?.bundleIdentifier).toBe("com.x.app");
      expect(CONFIG_IOS_ICON_FILE).toBe(IOS_ICON_FILE);
      expect(CONFIG_ANDROID_FOREGROUND_FILE).toBe(ANDROID_FOREGROUND_FILE);
      expect(CONFIG_FILE).toBe(NATIVE_CONFIG_FILE);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe(".well-known documents", () => {
  const config = {
    ...buildNativeConfig(
      null,
      parseArgs(["--server", "https://b.example", "--bundle-id", "com.x.app"]),
      brand
    ),
    appleTeamId: "TEAM1",
    androidFingerprints: [FINGERPRINT],
  };

  it("builds an AASA that opens guest paths and excludes admin and api", () => {
    const aasa = buildAasa(config) as {
      applinks: { details: { appIDs: string[]; components: Record<string, unknown>[] }[] };
    };
    const [detail] = aasa.applinks.details;
    expect(detail.appIDs).toEqual(["TEAM1.com.x.app"]);
    expect(detail.components).toContainEqual({ "/": "/admin/*", exclude: true });
    expect(detail.components).toContainEqual({ "/": "/api/*", exclude: true });
    expect(detail.components).toContainEqual({ "/": "/lookup*" });
    expect(detail.components).not.toContainEqual({ "/": "/*" });
  });

  it("builds assetlinks for the Android package and fingerprints", () => {
    expect(buildAssetLinks(config)).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.x.app",
          sha256_cert_fingerprints: [FINGERPRINT],
        },
      },
    ]);
  });
});

describe("fetchBrand", () => {
  it("summarises the brand response with defaults for blank fields", async () => {
    const fetchImpl = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ faviconIcon: null }),
        }) as unknown as Response
    );
    await expect(fetchBrand("https://b.example", fetchImpl)).resolves.toEqual({
      appName: "Open Resto",
      primaryColor: "#0a7ea4",
      hasIcon: false,
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://b.example/api/brand");
  });

  it("explains an unreachable or non-OK server", async () => {
    await expect(
      fetchBrand("https://b.example", async () => {
        throw new Error("ECONNREFUSED");
      })
    ).rejects.toThrow("Could not reach https://b.example/api/brand: ECONNREFUSED");
    await expect(
      fetchBrand(
        "https://b.example",
        async () => ({ ok: false, status: 502 }) as unknown as Response
      )
    ).rejects.toThrow("answered 502");
  });
});

describe("run", () => {
  let root: string;
  const log = jest.fn();

  const fakeServer =
    (icons: boolean) =>
    async (url: string): Promise<Response> => {
      if (url.endsWith("/api/brand")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            appName: "Bistro",
            primaryColor: "#aa3311",
            faviconIcon: icons ? "wine" : null,
          }),
        } as unknown as Response;
      }
      if (url.endsWith(IOS_ICON_ENDPOINT) || url.endsWith(ANDROID_FOREGROUND_ENDPOINT)) {
        if (!icons) return { ok: false, status: 404 } as unknown as Response;
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new TextEncoder().encode(`png:${url}`).buffer,
        } as unknown as Response;
      }
      throw new Error(`unexpected ${url}`);
    };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "native-init-root-"));
    log.mockClear();
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("writes the config and both icons into native/ by default", async () => {
    const result = await run({
      argv: ["--server", "https://b.example", "--bundle-id", "com.x.app"],
      root,
      fetch: fakeServer(true),
      log,
    });
    const outDir = join(root, "native");
    expect(result?.outDir).toBe(outDir);
    expect(JSON.parse(readFileSync(join(outDir, CONFIG_FILE), "utf8")).name).toBe("Bistro");
    expect(readFileSync(join(outDir, IOS_ICON_FILE), "utf8")).toContain(IOS_ICON_ENDPOINT);
    expect(readFileSync(join(outDir, ANDROID_FOREGROUND_FILE), "utf8")).toContain(
      ANDROID_FOREGROUND_ENDPOINT
    );
    expect(existsSync(join(outDir, WELL_KNOWN_DIR))).toBe(false);
    expect(result?.written).toEqual({
      icons: [IOS_ICON_FILE, ANDROID_FOREGROUND_FILE],
      missingIcons: [],
      wellKnown: [],
    });
    expect(log.mock.calls.flat().join("\n")).toContain("eas-cli init");
  });

  it("reports missing icons when the server has no brand icon, and keeps an override", async () => {
    const artwork = join(root, "my-icon.png");
    writeFileSync(artwork, "real artwork");
    const result = await run({
      argv: [
        "--server",
        "https://b.example",
        "--bundle-id",
        "com.x.app",
        "--icon",
        "my-icon.png",
        "--out",
        "out",
      ],
      root,
      fetch: fakeServer(false),
      log,
    });
    expect(readFileSync(join(root, "out", IOS_ICON_FILE), "utf8")).toBe("real artwork");
    expect(result?.written.icons).toEqual([IOS_ICON_FILE]);
    expect(result?.written.missingIcons).toEqual([ANDROID_FOREGROUND_FILE]);
    expect(log.mock.calls.flat().join("\n")).toContain("bundled artwork");
  });

  it("keeps a previously downloaded icon when the server has since lost its icon", async () => {
    await run({
      argv: ["--server", "https://b.example", "--bundle-id", "com.x.app"],
      root,
      fetch: fakeServer(true),
      log,
    });
    const result = await run({ argv: [], root, fetch: fakeServer(false), log });
    expect(result?.written.icons).toEqual([IOS_ICON_FILE, ANDROID_FOREGROUND_FILE]);
    expect(result?.written.missingIcons).toEqual([]);
  });

  it("writes the .well-known files once the team id and fingerprint are known", async () => {
    await run({
      argv: ["--server", "https://b.example", "--bundle-id", "com.x.app"],
      root,
      fetch: fakeServer(true),
      log,
    });
    log.mockClear();
    const result = await run({
      argv: [
        "--apple-team-id",
        "TEAM1",
        "--android-fingerprint",
        FINGERPRINT,
        "--project-id",
        "p-1",
      ],
      root,
      fetch: fakeServer(true),
      log,
    });
    const wellKnown = join(root, "native", WELL_KNOWN_DIR);
    expect(
      JSON.parse(readFileSync(join(wellKnown, AASA_FILE), "utf8")).applinks.details[0].appIDs
    ).toEqual(["TEAM1.com.x.app"]);
    expect(
      JSON.parse(readFileSync(join(wellKnown, ASSETLINKS_FILE), "utf8"))[0].target.package_name
    ).toBe("com.x.app");
    expect(result?.config.easProjectId).toBe("p-1");
    expect(result?.written.wellKnown).toEqual([AASA_FILE, ASSETLINKS_FILE]);
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("Copy .well-known/");
    expect(output).not.toContain("eas-cli init");
  });

  it("fails on a missing override file and on a missing server", async () => {
    await expect(
      run({
        argv: ["--server", "https://b.example", "--bundle-id", "com.x.app", "--icon", "nope.png"],
        root,
        fetch: fakeServer(true),
        log,
      })
    ).rejects.toThrow("Icon file not found");
    await expect(
      run({ argv: ["--bundle-id", "com.x.app"], root, fetch: fakeServer(true), log })
    ).rejects.toThrow("--server is required");
  });

  it("prints usage for --help without touching the disk or the network", async () => {
    const fetchImpl = jest.fn();
    expect(await run({ argv: ["--help"], root, fetch: fetchImpl, log })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("nextSteps names every remaining step", () => {
    const config = buildNativeConfig(
      null,
      parseArgs(["--server", "https://b.example", "--bundle-id", "com.x.app"]),
      brand
    );
    const text = nextSteps(config, { icons: [], missingIcons: [IOS_ICON_FILE], wellKnown: [] });
    expect(text).toContain("--project-id");
    expect(text).toContain("--android-fingerprint");
    expect(text).toContain("--apple-team-id");
    expect(text).toContain("bundled artwork");
  });
});
