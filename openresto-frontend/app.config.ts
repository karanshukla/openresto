import { ExpoConfig, ConfigContext } from "expo/config";

import { version } from "./package.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.EXPO_PUBLIC_APP_NAME ?? "Open Resto",
  slug: "openresto-frontend",
  version,
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: "openrestofrontend",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0a7ea4",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
    name: process.env.EXPO_PUBLIC_APP_NAME ?? "Open Resto",
    shortName: "OpenResto",
    description: "Restaurant table booking system",
    themeColor: "#0a7ea4",
    backgroundColor: "#111214",
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
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0a7ea4",
        dark: {
          backgroundColor: "#111214",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
