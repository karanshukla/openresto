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

// The system date picker (#423) is a native view with no JS host under Jest, the same way
// expo-localization and expo-network are. Rendered as a plain view carrying its props so the
// suites that merely mount a booking form don't have to know it is there; the DatePicker's own
// tests replace this with a mock that can also fire `onChange`.
jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement(View, props),
  };
});

// Home-screen quick actions (#431) are a native module with no JS host under Jest, and its own
// web stub is not what the default (iOS) platform resolves. Inert here; the service's own tests
// replace this with a mock that can fire a launch.
jest.mock("expo-quick-actions", () => ({
  initial: undefined,
  setItems: jest.fn(() => Promise.resolve()),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// The booking sheet (#425) is a native gesture/animation stack with no host under Jest. The
// mock keeps the pieces the drawer actually depends on observable: the modal presents itself
// through a ref and reports dismissal upward, and the scroller is a plain view.
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  const BottomSheetModal = React.forwardRef(
    (
      { children, onDismiss, ...props }: Record<string, unknown> & { children?: React.ReactNode },
      ref: React.Ref<unknown>
    ) => {
      React.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: () => (onDismiss as (() => void) | undefined)?.(),
      }));
      return React.createElement(View, { testID: "booking-drawer", ...props }, children);
    }
  );
  BottomSheetModal.displayName = "BottomSheetModal";
  return {
    __esModule: true,
    default: View,
    BottomSheetModal,
    BottomSheetModalProvider: ({ children }: { children?: React.ReactNode }) => children,
    BottomSheetScrollView: View,
    BottomSheetBackdrop: View,
    BottomSheetView: View,
  };
});

// The native tab bar (#426) is a react-native-screens host with no JS implementation under Jest,
// and its module pulls in an ESM-only dependency the transform list does not cover. Rendered as
// plain views that keep their props, so a test can read what each trigger asked for; the label
// renders its text and the icon keeps its glyph sets as props rather than drawing anything.
jest.mock("expo-router/unstable-native-tabs", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  const Trigger = ({
    children,
    ...props
  }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement(View, { testID: `native-tab-trigger-${props.name}`, ...props }, children);
  Trigger.Label = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(Text, { testID: "native-tab-label" }, children);
  Trigger.Icon = (props: Record<string, unknown>) =>
    React.createElement(View, { testID: "native-tab-icon", ...props });
  Trigger.VectorIcon = (props: Record<string, unknown>) =>
    React.createElement(View, { testID: "native-tab-vector-icon", ...props });
  Trigger.Badge = () => null;
  const NativeTabs = ({
    children,
    ...props
  }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement(View, { testID: "native-tabs", ...props }, children);
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});
