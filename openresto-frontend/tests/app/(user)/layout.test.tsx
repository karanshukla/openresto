import React from "react";
import { render } from "@testing-library/react-native";

// The layout's offline strip takes the top safe-area inset, and the hook throws outside a
// provider — the app mounts one in app/_layout.tsx, these tests render the layout alone.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/api/admin", () => ({
  getAdminOverview: jest.fn(),
}));

jest.mock("@/api/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Slot: () => null,
  Stack: Object.assign(() => null, {
    Screen: () => null,
  }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/",
  useSegments: () => ["(user)"],
}));

jest.mock("@/components/layout/Navbar", () => ({
  __esModule: true,
  default: () => null,
}));

describe("UserLayout", () => {
  it("renders without crashing on native", () => {
    const { default: UserLayout } = require("@/app/(user)/_layout");
    expect(() => render(<UserLayout />)).not.toThrow();
  });
});
