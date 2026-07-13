/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Linking, useWindowDimensions } from "react-native";
import Footer from "@/components/layout/Footer";
import { fetchSocialLinks } from "@/api/restaurants";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ width: 1024, height: 768 }),
}));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: jest.fn(),
}));

import { useAppTheme } from "@/hooks/use-app-theme";

jest.mock("expo-router", () => ({
  Link: ({ children }: any) => children,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/api/restaurants", () => ({
  fetchSocialLinks: jest.fn(),
}));

describe("Footer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    (useAppTheme as jest.Mock).mockReturnValue({
      brand: { appName: "Test App", primaryColor: "#0a7ea4" },
      colors: { border: "#ccc", muted: "#666" },
    });
    (fetchSocialLinks as jest.Mock).mockResolvedValue([]);
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
  });

  it("renders a default copyright when none is configured", () => {
    render(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} Test App. All rights reserved.`)).toBeTruthy();
  });

  it("renders a custom copyright when configured", () => {
    (useAppTheme as jest.Mock).mockReturnValue({
      brand: { appName: "Test App", primaryColor: "#0a7ea4", copyrightText: "© 2020 Custom Co." },
      colors: { border: "#ccc", muted: "#666" },
    });
    render(<Footer />);
    expect(screen.getByText("© 2020 Custom Co.")).toBeTruthy();
  });

  it("renders the Admin link", () => {
    render(<Footer />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("renders no social icons when none are configured", async () => {
    render(<Footer />);
    await waitFor(() => expect(fetchSocialLinks).toHaveBeenCalled());
    expect(screen.queryByLabelText("Instagram")).toBeNull();
  });

  it("renders configured social links and opens their URL on press", async () => {
    (fetchSocialLinks as jest.Mock).mockResolvedValue([
      {
        id: 1,
        label: "Instagram",
        url: "https://instagram.com/resto",
        iconKey: "logo-instagram",
        sortOrder: 0,
      },
    ]);
    render(<Footer />);

    const instagramBtn = await screen.findByLabelText("Instagram");
    expect(screen.queryByLabelText("Facebook")).toBeNull();
    fireEvent.press(instagramBtn);
    expect(Linking.openURL).toHaveBeenCalledWith("https://instagram.com/resto");
  });

  it("stacks copyright and links vertically on mobile widths", () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 500, height: 768 });
    render(<Footer />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });
});
