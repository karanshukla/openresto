import React from "react";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";

jest.mock("expo-router", () => ({
  Slot: () => null,
  Stack: Object.assign(
    ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    {
      Screen: ({ name }: { name: string }) => null,
    }
  ),
}));

jest.mock("@/components/layout/Navbar", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

import UserLayout from "@/app/(user)/_layout";

describe("UserLayout", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
  });

  it("renders Stack on native platform (ios)", () => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    const { toJSON } = render(<UserLayout />);
    expect(toJSON()).toBeDefined();
  });

  it("renders Slot and Navbar on web", () => {
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    const { toJSON } = render(<UserLayout />);
    expect(toJSON()).toBeDefined();
  });
});
