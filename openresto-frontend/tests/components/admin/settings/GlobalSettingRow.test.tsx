import React from "react";
import { render, screen } from "@testing-library/react-native";
import { GlobalSettingRow } from "@/components/admin/settings/GlobalSettingRow";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockUseBrand = jest.fn(() => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockUseBrand(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("GlobalSettingRow", () => {
  const baseProps = {
    icon: "settings-outline" as const,
    title: "My Setting",
    sub: "A subtitle",
    mutedColor: "#888",
    borderColor: "#ddd",
    cardBg: "#fff",
  };

  it("renders title and sub text", () => {
    render(<GlobalSettingRow {...baseProps} />);
    expect(screen.getByText("My Setting")).toBeTruthy();
    expect(screen.getByText("A subtitle")).toBeTruthy();
  });

  it("shows 'Soon' badge when comingSoon is true", () => {
    render(<GlobalSettingRow {...baseProps} comingSoon />);
    expect(screen.getByText("Soon")).toBeTruthy();
  });

  it("does not show 'Soon' badge when comingSoon is false", () => {
    render(<GlobalSettingRow {...baseProps} comingSoon={false} />);
    expect(screen.queryByText("Soon")).toBeNull();
  });

  it("does not show 'Soon' badge when comingSoon is omitted", () => {
    render(<GlobalSettingRow {...baseProps} />);
    expect(screen.queryByText("Soon")).toBeNull();
  });

  it("falls back to COLORS.primary when brand primaryColor is empty", () => {
    mockUseBrand.mockReturnValueOnce({ primaryColor: "", appName: "Open Resto" });
    render(<GlobalSettingRow {...baseProps} />);
    expect(screen.getByText("My Setting")).toBeTruthy();
    mockUseBrand.mockReturnValue({ primaryColor: "#0a7ea4", appName: "Open Resto" });
  });
});
