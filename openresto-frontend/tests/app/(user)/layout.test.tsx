import React from "react";
import { render } from "@testing-library/react-native";

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
