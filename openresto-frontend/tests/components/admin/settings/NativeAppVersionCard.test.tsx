/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { NativeAppVersionCard } from "@/components/admin/settings/NativeAppVersionCard";
import * as adminApi from "@/api/admin";

jest.mock("@/api/admin", () => ({
  saveBrandSettings: jest.fn(),
}));

let mockBrandData: { primaryColor: string; appName: string; minimumAppVersion?: string } = {
  primaryColor: "#0a7ea4",
  appName: "Open Resto",
};

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockBrandData,
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = { borderColor: "#ddd", mutedColor: "#888", cardBg: "#fff" };

/** Runs out the autosave debounce and lets the save promise settle. */
const flushAutosave = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
};

const field = () => screen.getByPlaceholderText("1.9.0");

describe("NativeAppVersionCard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: "Saved." },
    });
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("says any version is accepted when no floor is set", () => {
    render(<NativeAppVersionCard {...baseProps} />);
    expect(screen.getByText("Any version accepted")).toBeTruthy();
  });

  it("pre-fills the stored floor and names it in the subtitle", () => {
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto", minimumAppVersion: "1.8.0" };
    render(<NativeAppVersionCard {...baseProps} />);
    expect(screen.getByDisplayValue("1.8.0")).toBeTruthy();
    expect(screen.getByText("1.8.0")).toBeTruthy();
  });

  it("saves a well-formed version", async () => {
    render(<NativeAppVersionCard {...baseProps} />);
    fireEvent.changeText(field(), " 1.9.0 ");
    await flushAutosave();

    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith({ minimumAppVersion: "1.9.0" });
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  // The server rejects anything but three numbers, so a version being typed must not be sent —
  // and with no button to grey out, the reason has to be on screen or it reads as a broken card.
  it("withholds a half-typed version and says why", async () => {
    render(<NativeAppVersionCard {...baseProps} />);
    fireEvent.changeText(field(), "1.9");
    await flushAutosave();

    expect(adminApi.saveBrandSettings).not.toHaveBeenCalled();
    expect(screen.getByText("Not saved: use three numbers, like 1.9.0.")).toBeTruthy();

    fireEvent.changeText(field(), "1.9.0");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith({ minimumAppVersion: "1.9.0" });
  });

  it("rejects a four-part version", async () => {
    render(<NativeAppVersionCard {...baseProps} />);
    fireEvent.changeText(field(), "1.9.0.1");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).not.toHaveBeenCalled();
  });

  // An omitted field means "leave it alone" to the API, so emptying the input has to travel
  // as an explicit empty string or the stored floor survives the clear.
  it("sends an empty string to clear the floor", async () => {
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto", minimumAppVersion: "1.8.0" };
    render(<NativeAppVersionCard {...baseProps} />);
    fireEvent.changeText(field(), "");
    await flushAutosave();

    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith({ minimumAppVersion: "" });
  });

  it("syncs the field when brand context updates", async () => {
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto", minimumAppVersion: "1.8.0" };
    const { rerender } = render(<NativeAppVersionCard {...baseProps} />);
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto", minimumAppVersion: "1.9.0" };
    await act(async () => {
      rerender(<NativeAppVersionCard {...baseProps} />);
    });
    expect(screen.getByDisplayValue("1.9.0")).toBeTruthy();
  });

  it("surfaces a rejected save with the server's message", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      ok: false,
      message: "Minimum app version must be major.minor.patch.",
    });
    render(<NativeAppVersionCard {...baseProps} />);
    fireEvent.changeText(field(), "1.9.0");
    await flushAutosave();

    expect(screen.getByText("Minimum app version must be major.minor.patch.")).toBeTruthy();
  });

  it("reports an unreachable server", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue(null);
    render(<NativeAppVersionCard {...baseProps} />);
    fireEvent.changeText(field(), "1.9.0");
    await flushAutosave();
    expect(screen.getByText("Couldn't reach the server.")).toBeTruthy();
  });

  it("puts the previous floor back when the save is undone", async () => {
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto", minimumAppVersion: "1.8.0" };
    render(<NativeAppVersionCard {...baseProps} />);
    fireEvent.changeText(field(), "1.9.0");
    await flushAutosave();

    await act(async () => {
      fireEvent.press(screen.getByText("Undo"));
    });
    expect(screen.getByDisplayValue("1.8.0")).toBeTruthy();
  });

  it("collapses when the header is pressed", () => {
    render(<NativeAppVersionCard {...baseProps} />);
    expect(screen.getByText("Minimum version")).toBeTruthy();
    fireEvent.press(screen.getByText("Minimum supported app version"));
    expect(screen.queryByText("Minimum version")).toBeNull();
  });
});
