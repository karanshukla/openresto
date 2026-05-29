import React from "react";
import { render, screen } from "@testing-library/react-native";
import { GlobalSettingRow } from "@/components/admin/settings/GlobalSettingRow";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("GlobalSettingRow", () => {
  const defaultProps = {
    icon: "notifications-outline" as const,
    title: "Notifications",
    sub: "Manage notification settings",
    mutedColor: "#888",
    borderColor: "#eee",
    cardBg: "#fff",
  };

  it("renders title and subtitle", () => {
    render(<GlobalSettingRow {...defaultProps} />);
    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getByText("Manage notification settings")).toBeTruthy();
  });

  it("renders 'Soon' badge when comingSoon is true", () => {
    render(<GlobalSettingRow {...defaultProps} comingSoon={true} />);
    expect(screen.getByText("Soon")).toBeTruthy();
  });

  it("does not render 'Soon' badge when comingSoon is false", () => {
    render(<GlobalSettingRow {...defaultProps} comingSoon={false} />);
    expect(screen.queryByText("Soon")).toBeNull();
  });

  it("renders without comingSoon prop (defaults to undefined)", () => {
    const { toJSON } = render(<GlobalSettingRow {...defaultProps} />);
    expect(toJSON()).toBeDefined();
    expect(screen.queryByText("Soon")).toBeNull();
  });

  it("renders with different icons", () => {
    const { toJSON } = render(
      <GlobalSettingRow {...defaultProps} icon="lock-closed-outline" title="Security" sub="Manage security" />
    );
    expect(toJSON()).toBeDefined();
    expect(screen.getByText("Security")).toBeTruthy();
  });
});
