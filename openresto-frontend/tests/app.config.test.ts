import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import buildConfig, {
  ANDROID_FOREGROUND_FILE,
  IOS_ICON_FILE,
  NATIVE_CONFIG_FILE,
  NATIVE_DIR_ENV,
  NativeAppConfig,
  buildExpoConfig,
  loadNativeConfig,
} from "../app.config";

const nativeConfig: NativeAppConfig = {
  serverUrl: "https://bookings.example.com/",
  name: "Bistro Bookings",
  slug: "bistro-bookings",
  scheme: "bistrobookings",
  primaryColor: "#aa3311",
  bundleIdentifier: "com.example.bistro",
  androidPackage: "com.example.bistro",
  linkPaths: ["/lookup", "/booking-confirmation"],
  easProjectId: "11111111-2222-3333-4444-555555555555",
  easOwner: "bistro-org",
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "openresto-native-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env[NATIVE_DIR_ENV];
});

describe("loadNativeConfig", () => {
  it("returns null when the directory holds no config (the web build, or nothing generated)", () => {
    expect(loadNativeConfig(dir)).toBeNull();
    expect(loadNativeConfig(join(dir, "does-not-exist"))).toBeNull();
  });

  it("returns the parsed config when every required field is present", () => {
    writeFileSync(join(dir, NATIVE_CONFIG_FILE), JSON.stringify(nativeConfig));
    expect(loadNativeConfig(dir)).toEqual(nativeConfig);
  });

  it.each(["serverUrl", "bundleIdentifier", "androidPackage", "scheme"] as const)(
    "throws naming the missing field when %s is absent",
    (field) => {
      const partial: Partial<NativeAppConfig> = { ...nativeConfig };
      delete partial[field];
      writeFileSync(join(dir, NATIVE_CONFIG_FILE), JSON.stringify(partial));
      expect(() => loadNativeConfig(dir)).toThrow(`"${field}" is required`);
    }
  );

  it("throws when linkPaths is not a list", () => {
    writeFileSync(
      join(dir, NATIVE_CONFIG_FILE),
      JSON.stringify({ ...nativeConfig, linkPaths: "/lookup" })
    );
    expect(() => loadNativeConfig(dir)).toThrow('"linkPaths" is required');
  });
});

describe("buildExpoConfig without a native config", () => {
  it("keeps the upstream identity and bundled artwork", () => {
    const config = buildExpoConfig({}, null, dir);
    expect(config.name).toBe("Open Resto");
    expect(config.slug).toBe("openresto-frontend");
    expect(config.scheme).toBe("openrestofrontend");
    expect(config.icon).toBe("./assets/images/icon.png");
    expect(config.ios).toEqual({ supportsTablet: true });
    expect(config.android?.package).toBeUndefined();
    expect(config.android?.intentFilters).toBeUndefined();
    expect(config.android?.adaptiveIcon?.backgroundColor).toBe("#0a7ea4");
    expect(config.extra).toBeUndefined();
    expect(config.owner).toBeUndefined();
  });

  // #430. The gesture previews the screen underneath instead of jumping, which is one of the
  // first things that reads as "not a native app" when it is off. Every overlay dismisses
  // through Modal.onRequestClose, pinned structurally in backDismissal.test.ts.
  it("lets Android preview the screen behind the back gesture", () => {
    const config = buildExpoConfig({}, null, "./native");

    expect(config.android?.predictiveBackGestureEnabled).toBe(true);
  });

  it("still honours EXPO_PUBLIC_APP_NAME for the name", () => {
    process.env.EXPO_PUBLIC_APP_NAME = "Named By Env";
    try {
      expect(buildExpoConfig({}, null, dir).name).toBe("Named By Env");
    } finally {
      delete process.env.EXPO_PUBLIC_APP_NAME;
    }
  });
});

describe("buildExpoConfig with a native config", () => {
  it("bakes the publisher's identity, deep links, API base and EAS project in", () => {
    const config = buildExpoConfig({}, nativeConfig, dir);

    expect(config.name).toBe("Bistro Bookings");
    expect(config.slug).toBe("bistro-bookings");
    expect(config.scheme).toBe("bistrobookings");
    expect(config.owner).toBe("bistro-org");
    expect(config.ios).toEqual({
      supportsTablet: true,
      bundleIdentifier: "com.example.bistro",
      associatedDomains: ["applinks:bookings.example.com"],
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    });
    expect(config.android?.package).toBe("com.example.bistro");
    expect(config.android?.intentFilters).toEqual([
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "bookings.example.com", pathPrefix: "/lookup" },
          { scheme: "https", host: "bookings.example.com", pathPrefix: "/booking-confirmation" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ]);
    expect(config.android?.adaptiveIcon?.backgroundColor).toBe("#aa3311");
    expect(config.extra).toEqual({
      apiUrl: "https://bookings.example.com/api",
      eas: { projectId: "11111111-2222-3333-4444-555555555555" },
    });
  });

  it("omits the EAS project and owner until the self-hoster has one", () => {
    const { easProjectId: _id, easOwner: _owner, ...withoutEas } = nativeConfig;
    const config = buildExpoConfig({}, withoutEas, dir);
    expect(config.extra).toEqual({ apiUrl: "https://bookings.example.com/api" });
    expect(config.owner).toBeUndefined();
  });

  it("uses bundled artwork when no icons were generated", () => {
    const config = buildExpoConfig({}, nativeConfig, dir);
    expect(config.icon).toBe("./assets/images/icon.png");
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe(
      "./assets/images/android-icon-foreground.png"
    );
  });

  it("uses the generated icons, and the foreground glyph as monochrome and splash image", () => {
    writeFileSync(join(dir, IOS_ICON_FILE), "png");
    writeFileSync(join(dir, ANDROID_FOREGROUND_FILE), "png");
    const config = buildExpoConfig({}, nativeConfig, dir);
    const foreground = join(dir, ANDROID_FOREGROUND_FILE);

    expect(config.icon).toBe(join(dir, IOS_ICON_FILE));
    expect(config.android?.adaptiveIcon).toEqual({
      backgroundColor: "#aa3311",
      foregroundImage: foreground,
      monochromeImage: foreground,
    });
    const splash = (config.plugins ?? []).find(
      (p) => Array.isArray(p) && p[0] === "expo-splash-screen"
    ) as [string, { image: string; backgroundColor: string }];
    expect(splash[1].image).toBe(foreground);
    expect(splash[1].backgroundColor).toBe("#aa3311");
  });
});

describe("default export", () => {
  it("reads the native directory named by the environment", () => {
    writeFileSync(join(dir, NATIVE_CONFIG_FILE), JSON.stringify(nativeConfig));
    process.env[NATIVE_DIR_ENV] = dir;
    expect(
      buildConfig({ config: {}, projectRoot: dir, staticConfigPath: null, packageJsonPath: null })
        .name
    ).toBe("Bistro Bookings");
  });

  it("falls back to ./native, which the repo checkout does not have", () => {
    expect(
      buildConfig({ config: {}, projectRoot: dir, staticConfigPath: null, packageJsonPath: null })
        .name
    ).toBe("Open Resto");
  });

  it("configures expo-notifications with the brand colour and the adaptive foreground as its icon", () => {
    const iconDir = mkdtempSync(join(tmpdir(), "openresto-notif-"));
    try {
      const bare = buildExpoConfig({}, null, iconDir);
      const barePlugin = (bare.plugins ?? []).find(
        (p) => Array.isArray(p) && p[0] === "expo-notifications"
      ) as [string, { color: string; icon?: string }];
      expect(barePlugin[1].icon).toBeUndefined();

      writeFileSync(join(iconDir, ANDROID_FOREGROUND_FILE), "png");
      const withIcon = buildExpoConfig({}, nativeConfig, iconDir);
      const plugin = (withIcon.plugins ?? []).find(
        (p) => Array.isArray(p) && p[0] === "expo-notifications"
      ) as [string, { color: string; icon?: string }];
      expect(plugin[1].color).toBe("#aa3311");
      expect(plugin[1].icon).toBe(join(iconDir, ANDROID_FOREGROUND_FILE));
    } finally {
      rmSync(iconDir, { recursive: true, force: true });
    }
  });
});
