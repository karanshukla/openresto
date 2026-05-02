/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react-native";
import Skeleton from "@/components/common/Skeleton";
import { AppThemeProvider } from "@/context/ThemeContext";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("Skeleton", () => {
  it("renders correctly with default props", () => {
    const { toJSON } = render(
      <AppThemeProvider>
        <Skeleton />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders with custom dimensions", () => {
    const { toJSON } = render(
      <AppThemeProvider>
        <Skeleton width={100} height={50} borderRadius={10} />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it("applies custom styles", () => {
    const { toJSON } = render(
      <AppThemeProvider>
        <Skeleton style={{ marginTop: 10 }} />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
  });
});
