/**
 * @jest-environment jsdom
 */
import React from "react";
import { Platform } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { NativeAppReadinessCard } from "@/components/admin/settings/NativeAppReadinessCard";
import type { NativeAppCheck, NativeAppStatus } from "@/api/nativeApp";

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

const check = (over: Partial<NativeAppCheck> = {}): NativeAppCheck => ({
  id: "https",
  status: "pass",
  detail: null,
  url: null,
  ...over,
});

const statusWith = (checks: NativeAppCheck[], serverUrl: string | null): NativeAppStatus => ({
  serverUrl,
  checks,
  minimumAppVersion: null,
  clients: [],
});

const renderCard = (
  status: NativeAppStatus | null,
  over: { loading?: boolean; failed?: boolean; onRecheck?: () => void } = {}
) =>
  render(
    <NativeAppReadinessCard
      {...baseProps}
      status={status}
      loading={over.loading ?? false}
      failed={over.failed ?? false}
      onRecheck={over.onRecheck ?? jest.fn()}
    />
  );

describe("NativeAppReadinessCard", () => {
  // The admin only ever renders on web; jest-expo defaults to "ios", which would take the
  // card down the no-window path its own guard exists for.
  const originalOS = Platform.OS;
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(Platform, "OS", { get: () => originalOS, configurable: true });
  });

  it("says the checks are running while they load", () => {
    renderCard(null, { loading: true });
    expect(screen.getAllByText("Running the checks…").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("native-app-recheck")).toBeNull();
  });

  it("offers a retry rather than a checklist when the request was refused", () => {
    const onRecheck = jest.fn();
    renderCard(null, { failed: true, onRecheck });

    expect(screen.getAllByText("Couldn't load the readiness checks.").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId("native-app-readiness-retry"));
    expect(onRecheck).toHaveBeenCalled();
  });

  it("shows the address the checks ran against", () => {
    renderCard(statusWith([check()], "https://bookings.example.com"));
    expect(screen.getByTestId("native-app-server-url").props.children).toBe(
      "https://bookings.example.com"
    );
  });

  it("says so when no public address is configured", () => {
    renderCard(statusWith([check()], null));
    expect(screen.queryByTestId("native-app-server-url")).toBeNull();
    expect(
      screen.getByText(
        "No public address is configured, so the checks that fetch from your domain cannot run. Set the website URL under Brand."
      )
    ).toBeTruthy();
  });

  // The fix is what makes the row actionable, and a passing row that carried one would read
  // as an instruction to change something that already works.
  it("carries the fix on a failing check and not on a passing one", () => {
    renderCard(
      statusWith(
        [
          check({ id: "https", status: "pass" }),
          check({ id: "privacyPolicy", status: "fail", detail: "No URL is set." }),
        ],
        "https://bookings.example.com"
      )
    );

    expect(screen.getByText("Public address uses HTTPS")).toBeTruthy();
    expect(
      screen.queryByText(
        "Serve this instance over https. Deep links and iOS transport security both refuse plain http."
      )
    ).toBeNull();

    expect(screen.getByText("Privacy policy URL set")).toBeTruthy();
    expect(
      screen.getByText(
        "Add one in the Contact & Website card under Settings → Brand. Both stores require it before a listing can be published."
      )
    ).toBeTruthy();
    expect(screen.getByText("No URL is set.")).toBeTruthy();
  });

  it("explains a skipped check too, since nothing ran to prove it", () => {
    renderCard(
      statusWith([check({ id: "androidAssetLinks", status: "skip" })], "https://x.example.com")
    );
    expect(
      screen.getByText(
        "Run native:init with --android-fingerprint, then copy native/.well-known/ into the well-known folder beside your compose file."
      )
    ).toBeTruthy();
  });

  it("summarises how many checks need attention", () => {
    renderCard(
      statusWith(
        [check({ status: "fail" }), check({ id: "brandIcon", status: "fail" }), check()],
        "https://x.example.com"
      )
    );
    expect(screen.getByText("2 checks need attention")).toBeTruthy();
  });

  it("summarises a clean run", () => {
    renderCard(statusWith([check()], "https://x.example.com"));
    expect(screen.getByText("Everything a submission needs is in place")).toBeTruthy();
  });

  it("opens a check's own URL in a new tab", () => {
    const open = jest.fn();
    window.open = open;
    renderCard(
      statusWith(
        [
          check({
            id: "appleAppSiteAssociation",
            status: "fail",
            url: "https://x.example.com/.well-known/apple-app-site-association",
          }),
        ],
        "https://x.example.com"
      )
    );

    fireEvent.press(screen.getByTestId("native-app-check-open-appleAppSiteAssociation"));
    expect(open).toHaveBeenCalledWith(
      "https://x.example.com/.well-known/apple-app-site-association",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("offers no Open control for a check that fetched nothing", () => {
    renderCard(statusWith([check({ id: "brandIcon", status: "fail" })], "https://x.example.com"));
    expect(screen.queryByTestId("native-app-check-open-brandIcon")).toBeNull();
  });

  it("re-runs the checks on Re-check", () => {
    const onRecheck = jest.fn();
    renderCard(statusWith([check()], "https://x.example.com"), { onRecheck });
    fireEvent.press(screen.getByTestId("native-app-recheck"));
    expect(onRecheck).toHaveBeenCalled();
  });

  it("collapses when the header is pressed", () => {
    renderCard(statusWith([check()], "https://x.example.com"));
    expect(screen.getByText("Public address uses HTTPS")).toBeTruthy();
    fireEvent.press(screen.getByText("Store readiness"));
    expect(screen.queryByText("Public address uses HTTPS")).toBeNull();
  });
});
