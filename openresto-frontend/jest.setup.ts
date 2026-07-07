/**
 * Global Jest setup — runs once per test file before any tests execute.
 * Consolidates the mechanical mocks that were copy-pasted across ~150 test files.
 * (Bundle 13: Test Infrastructure & Fixtures.)
 *
 * Per-file `jest.mock(...)` calls still win over these globals (Jest hoists
 * per-file mocks and they shadow the setup), so any test that needs a different
 * shape for a specific module can still override it locally.
 */

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
