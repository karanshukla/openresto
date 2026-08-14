/**
 * Shared test provider wrapper. Extracted from the 11+ identical inline copies
 * that existed across screen tests. (Bundle 13: Test Infrastructure & Fixtures.)
 *
 * Wraps UI in the SafeArea + Theme + Brand providers that screen components
 * expect, with zero insets (deterministic for layout-agnostic assertions).
 */
import React from "react";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";
import { AuthProvider } from "@/context/AuthContext";

const ZERO_INSETS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

interface Options {
  /**
   * Adds AuthProvider, for admin components that read the signed-in identity. Opt-in because
   * the provider resolves a session on mount — an extra request that user-facing screen tests
   * neither need nor expect in their fetch mocks. With it on, mock `checkSession` from
   * `@/api/auth` to control who is signed in.
   */
  withAuth?: boolean;
}

export function renderWithProviders(ui: React.ReactElement, { withAuth }: Options = {}) {
  const body = withAuth ? <AuthProvider>{ui}</AuthProvider> : ui;
  return render(
    <SafeAreaProvider initialMetrics={ZERO_INSETS}>
      <AppThemeProvider>
        <BrandProvider>{body}</BrandProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
