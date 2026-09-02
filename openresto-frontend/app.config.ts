import { ExpoConfig, ConfigContext } from "expo/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { version } from "./package.json";

/**
 * Per-publisher settings for a self-hoster's own native build of the guest app (issue #388),
 * written by `npm run native:init` into the gitignored `native/` directory and read here at
 * config time. The web build never has one, and without one this config is unchanged.
 * See docs/native-app.md.
 */
export interface NativeAppConfig {
  /** The instance the binary talks to, e.g. `https://bookings.example.com`. Also the deep-link host. */
  serverUrl: string;
  name: string;
  slug: string;
  scheme: string;
  primaryColor: string;
  bundleIdentifier: string;
  androidPackage: string;
  /** Guest route prefixes that open in the app when a link to the instance is tapped. */
  linkPaths: string[];
  easProjectId?: string;
  easOwner?: string;
}

export const NATIVE_DIR_ENV = "OPENRESTO_NATIVE_DIR";
export const DEFAULT_NATIVE_DIR = "./native";
export const NATIVE_CONFIG_FILE = "app.native.json";
export const IOS_ICON_FILE = "icon-ios.png";
export const ANDROID_FOREGROUND_FILE = "icon-android-foreground.png";

const DEFAULT_NAME = "Open Resto";
const DEFAULT_PRIMARY_COLOR = "#0a7ea4";
const DARK_BACKGROUND = "#111214";

const REQUIRED_FIELDS: (keyof NativeAppConfig)[] = [
  "serverUrl",
  "name",
  "slug",
  "scheme",
  "primaryColor",
  "bundleIdentifier",
  "androidPackage",
];

/**
 * A half-written config must fail the build rather than produce a binary pointed at the wrong
 * server or signed under the wrong identifier, so every required field is checked here.
 *
 * @see [app.config.test.ts](./tests/app.config.test.ts) — pins that a missing directory means
 * "no native config" while a present file missing a field throws naming it.
 */
export function loadNativeConfig(dir: string): NativeAppConfig | null {
  const file = join(dir, NATIVE_CONFIG_FILE);
  if (!existsSync(file)) return null;

  const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<NativeAppConfig>;
  for (const field of REQUIRED_FIELDS) {
    if (typeof parsed[field] !== "string" || parsed[field] === "") {
      throw new Error(`${file}: "${field}" is required. Re-run \`npm run native:init\`.`);
    }
  }
  if (!Array.isArray(parsed.linkPaths)) {
    throw new Error(`${file}: "linkPaths" is required. Re-run \`npm run native:init\`.`);
  }
  return parsed as NativeAppConfig;
}

function nativeAsset(dir: string, file: string): string | undefined {
  const path = join(dir, file);
  return existsSync(path) ? path : undefined;
}

export function buildExpoConfig(
  base: Partial<ExpoConfig>,
  native: NativeAppConfig | null,
  nativeDir: string
): ExpoConfig {
  const name = native?.name ?? process.env.EXPO_PUBLIC_APP_NAME ?? DEFAULT_NAME;
  const primaryColor = native?.primaryColor ?? DEFAULT_PRIMARY_COLOR;
  const iosIcon = nativeAsset(nativeDir, IOS_ICON_FILE);
  const androidForeground = nativeAsset(nativeDir, ANDROID_FOREGROUND_FILE);
  const linkHost = native ? new URL(native.serverUrl).host : undefined;

  return {
    ...base,
    name,
    slug: native?.slug ?? "openresto-frontend",
    ...(native?.easOwner ? { owner: native.easOwner } : {}),
    version,
    orientation: "default",
    icon: iosIcon ?? "./assets/images/icon.png",
    scheme: native?.scheme ?? "openrestofrontend",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      ...(native
        ? {
            bundleIdentifier: native.bundleIdentifier,
            associatedDomains: [`applinks:${linkHost}`],
            infoPlist: { ITSAppUsesNonExemptEncryption: false },
          }
        : {}),
    },
    android: {
      adaptiveIcon: {
        backgroundColor: primaryColor,
        // The generated foreground is a white glyph on transparency, which is also exactly
        // what Android 13's themed icons want, so it serves as the monochrome layer too.
        ...(androidForeground
          ? { foregroundImage: androidForeground, monochromeImage: androidForeground }
          : {
              foregroundImage: "./assets/images/android-icon-foreground.png",
              backgroundImage: "./assets/images/android-icon-background.png",
              monochromeImage: "./assets/images/android-icon-monochrome.png",
            }),
      },
      // Android 15+ previews the screen underneath as the gesture is dragged. Every overlay
      // in the app dismisses through `Modal.onRequestClose`, which React Native bridges to the
      // new OnBackInvokedCallback API; nothing hand-rolls `BackHandler`, which is what would
      // swallow the gesture instead (#430).
      predictiveBackGestureEnabled: true,
      ...(native
        ? {
            package: native.androidPackage,
            intentFilters: [
              {
                action: "VIEW",
                autoVerify: true,
                data: native.linkPaths.map((pathPrefix) => ({
                  scheme: "https",
                  host: linkHost,
                  pathPrefix,
                })),
                category: ["BROWSABLE", "DEFAULT"],
              },
            ],
          }
        : {}),
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
      name: process.env.EXPO_PUBLIC_APP_NAME ?? DEFAULT_NAME,
      shortName: "OpenResto",
      description: "Restaurant table booking system",
      themeColor: DEFAULT_PRIMARY_COLOR,
      backgroundColor: DARK_BACKGROUND,
    },
    plugins: [
      "expo-router",
      "expo-status-bar",
      "expo-asset",
      "expo-font",
      "expo-image",
      "expo-web-browser",
      "expo-localization",
      [
        "expo-notifications",
        {
          color: primaryColor,
          ...(androidForeground ? { icon: androidForeground } : {}),
        },
      ],
      [
        "expo-splash-screen",
        {
          image: androidForeground ?? "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: primaryColor,
          dark: {
            backgroundColor: DARK_BACKGROUND,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    ...(native
      ? {
          extra: {
            apiUrl: `${native.serverUrl.replace(/\/+$/, "")}/api`,
            ...(native.easProjectId ? { eas: { projectId: native.easProjectId } } : {}),
          },
        }
      : {}),
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const nativeDir = process.env[NATIVE_DIR_ENV] ?? DEFAULT_NATIVE_DIR;
  return buildExpoConfig(config, loadNativeConfig(nativeDir), nativeDir);
};
