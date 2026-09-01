import React from "react";
import { render, screen } from "@testing-library/react-native";
import OfflineBanner from "@/components/layout/OfflineBanner";
import { useOnline } from "@/hooks/use-online";

jest.mock("@/hooks/use-online", () => ({ useOnline: jest.fn() }));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Test App", primaryColor: "#0a7ea4" },
    colors: { muted: "#666", surfaceAlt: "#eee" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));

const mockUseOnline = useOnline as jest.MockedFunction<typeof useOnline>;

describe("OfflineBanner", () => {
  it("renders nothing while the device reports a connection", () => {
    mockUseOnline.mockReturnValue(true);

    render(<OfflineBanner />);

    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });

  it("warns that information may be stale while offline", () => {
    mockUseOnline.mockReturnValue(false);

    render(<OfflineBanner />);

    expect(screen.getByTestId("offline-banner")).toBeTruthy();
    expect(screen.getByText("You're offline. Some information may be out of date.")).toBeTruthy();
  });

  it("clears the status bar itself, since it sits above the navigator's header", () => {
    mockUseOnline.mockReturnValue(false);

    render(<OfflineBanner />);

    const style = screen.getByTestId("offline-banner").props.style;
    expect(style.flat().find((s: { paddingTop?: number }) => s?.paddingTop)?.paddingTop).toBe(28);
  });
});
