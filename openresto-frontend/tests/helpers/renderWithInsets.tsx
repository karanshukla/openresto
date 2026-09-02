/**
 * `renderWithProviders` with real safe-area insets, for the handful of rules about what a
 * component does with them — a sheet stepping up over the home indicator, a bar clearing the
 * status bar. Everything else keeps the zero insets the shared helper pins.
 */
import React from "react";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider, type EdgeInsets } from "react-native-safe-area-context";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";

export function renderWithInsets(insets: Partial<EdgeInsets>, ui: React.ReactElement) {
  const metrics = {
    frame: { x: 0, y: 0, width: 0, height: 0 },
    insets: { top: 0, left: 0, right: 0, bottom: 0, ...insets },
  };
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <BrandProvider>{ui}</BrandProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
