/**
 * Global Jest setup — runs once per test file before any tests execute.
 * Consolidates the mechanical mocks that were copy-pasted across ~150 test files.
 * (Bundle 13: Test Infrastructure & Fixtures.)
 *
 * Per-file `jest.mock(...)` calls still win over these globals (Jest hoists
 * per-file mocks and they shadow the setup), so any test that needs a different
 * shape for a specific module can still override it locally.
 */

// Initializes the global i18next singleton with the "en" resources, synchronously, before any
// test renders a `useTranslation()` consumer. Production gets this for free — `app/_layout.tsx`
// imports `LocaleContext`, which imports this module — but most component tests render a
// screen directly, without going through `_layout.tsx` or `LocaleProvider`, so `t()` would
// otherwise hit an uninitialized instance.
import "@/i18n";

// Theme hook — every screen/component reads color scheme via this. Pinned to
// "light" so snapshot/text assertions are deterministic across the suite.
jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// Vector icons render as null in tests (no font loading, no SVG machinery).
// Covers both icon families actually imported by app code.
jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));

// expo-localization's real implementation resolves to a native-module build under Jest's
// default "ios" haste platform (`requireNativeModule`, which throws with no native host), so
// every test that transitively imports LocaleContext needs this stubbed. Fixed "ltr" matches
// every locale this app ships — real RTL detection is groundwork, not exercised yet.
jest.mock("expo-localization", () => ({
  getLocales: () => [{ textDirection: "ltr" }],
}));

// expo-network resolves to a native module under Jest's default "ios" haste platform, the same
// way expo-localization does, so `useOnline` — mounted by the guest layout's offline banner —
// needs it stubbed. Reports a reachable network; tests of the offline paths override this.
jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true })
  ),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Brand fetch stub — BrandProvider fetches /api/brand on mount. Most screen
// tests render BrandProvider and need this resolved to avoid unhandled
// rejections. Individual tests that need a different brand response can still
// override `global.fetch` in their own beforeEach.
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;
