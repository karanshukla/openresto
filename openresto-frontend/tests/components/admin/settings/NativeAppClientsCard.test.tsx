/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import {
  NativeAppClientsCard,
  platformLabel,
} from "@/components/admin/settings/NativeAppClientsCard";
import type { NativeAppClient, NativeAppStatus } from "@/api/nativeApp";
import { setActiveLocale } from "@/utils/locale";

/**
 * The row renders through `relativeTime` and `fmtNumber`, which hand `getActiveLocale()` to
 * Intl — and an unset locale makes Intl follow the *machine*, not the app. Without this the
 * recency assertion below reads "2h ago" on an en-US CI runner and "2 hrs ago" on an en-CA
 * laptop, so the suite passes in CI and fails for whoever is not in en-US.
 */
beforeEach(() => setActiveLocale("en"));
afterEach(() => setActiveLocale(undefined));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = { borderColor: "#ddd", mutedColor: "#888", cardBg: "#fff" };

const client = (over: Partial<NativeAppClient> = {}): NativeAppClient => ({
  platform: "ios",
  appVersion: "1.9.0",
  lastSeenUtc: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  requestsLast7Days: 1234,
  requestsLast30Days: 5678,
  ...over,
});

const statusWith = (clients: NativeAppClient[]): NativeAppStatus => ({
  serverUrl: "https://bookings.example.com",
  checks: [],
  minimumAppVersion: null,
  clients,
});

const renderCard = (status: NativeAppStatus | null, loading = false) =>
  render(<NativeAppClientsCard {...baseProps} status={status} loading={loading} />);

describe("NativeAppClientsCard", () => {
  it("lists a connected build with its version, recency and counts", () => {
    renderCard(statusWith([client()]));

    expect(screen.getByTestId("native-app-client-ios-1.9.0")).toBeTruthy();
    expect(screen.getByText("iOS")).toBeTruthy();
    expect(screen.getByText("1.9.0")).toBeTruthy();
    expect(screen.getByText("2h ago")).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("5,678")).toBeTruthy();
  });

  it("names its columns", () => {
    renderCard(statusWith([client()]));
    expect(screen.getByText("Platform")).toBeTruthy();
    expect(screen.getByText("App version")).toBeTruthy();
    expect(screen.getByText("Last seen")).toBeTruthy();
    expect(screen.getByText("7 days")).toBeTruthy();
    expect(screen.getByText("30 days")).toBeTruthy();
  });

  it("counts the connected builds in its subtitle", () => {
    renderCard(statusWith([client(), client({ platform: "android", appVersion: "1.8.2" })]));
    expect(screen.getByText("2 builds have connected")).toBeTruthy();
    expect(screen.getByText("Android")).toBeTruthy();
  });

  // An empty table looks like a broken page; the reason nothing is listed is the content.
  it("explains an empty list rather than showing an empty table", () => {
    renderCard(statusWith([]));
    expect(
      screen.getByText(
        "No native build has connected yet. An app reports its platform and version on every request, so builds appear here once someone opens one."
      )
    ).toBeTruthy();
    expect(screen.queryByText("App version")).toBeNull();
  });

  it("says it is loading while the request is in flight", () => {
    renderCard(null, true);
    expect(screen.getAllByText("Loading connected builds…").length).toBeGreaterThan(0);
  });

  it("reports a refused request", () => {
    renderCard(null);
    expect(screen.getAllByText("Couldn't load the client list.").length).toBeGreaterThan(0);
  });

  it("collapses when the header is pressed", () => {
    renderCard(statusWith([client()]));
    expect(screen.getByText("App version")).toBeTruthy();
    fireEvent.press(screen.getByText("Installed clients"));
    expect(screen.queryByText("App version")).toBeNull();
  });

  // The server reports whatever the app's header said, so an unknown platform is data to show
  // rather than a case to drop.
  it("capitalises a platform it does not know", () => {
    expect(platformLabel("ios")).toBe("iOS");
    expect(platformLabel("android")).toBe("Android");
    expect(platformLabel("harmony")).toBe("Harmony");
  });

  it("renders a row for an unknown platform", () => {
    renderCard(statusWith([client({ platform: "harmony", appVersion: "2.0.0" })]));
    expect(screen.getByTestId("native-app-client-harmony-2.0.0")).toBeTruthy();
    expect(screen.getByText("Harmony")).toBeTruthy();
  });
});
