/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SaveStatus } from "@/components/admin/settings/SaveStatus";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const baseProps = { onRetry: jest.fn(), mutedColor: "#888" };

describe("SaveStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("says nothing while idle, but holds its place in the card", () => {
    render(<SaveStatus status="idle" {...baseProps} />);
    expect(screen.getByTestId("save-status")).toBeTruthy();
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("reports a save in flight", () => {
    render(<SaveStatus status="saving" {...baseProps} />);
    expect(screen.getByText("Saving…")).toBeTruthy();
  });

  it("reports a completed save", () => {
    render(<SaveStatus status="saved" {...baseProps} />);
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("shows the failure message and retries on request", () => {
    render(<SaveStatus status="error" error="Invalid primary color hex code." {...baseProps} />);
    expect(screen.getByText("Invalid primary color hex code.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Retry saving"));
    expect(baseProps.onRetry).toHaveBeenCalled();
  });

  it("falls back to a generic failure when there is no message", () => {
    render(<SaveStatus status="error" {...baseProps} />);
    expect(screen.getByText("Save failed")).toBeTruthy();
  });

  // Silence is the one thing a save-less card can't do: the admin has no button to look at.
  it("explains a withheld save instead of showing nothing", () => {
    render(
      <SaveStatus
        status="idle"
        blockedReason="Not saved: the app name can't be empty."
        {...baseProps}
      />
    );
    expect(screen.getByText("Not saved: the app name can't be empty.")).toBeTruthy();
  });

  it("keeps reporting an in-flight save over a blocked reason", () => {
    render(
      <SaveStatus status="saving" blockedReason="Not saved: fix the colour." {...baseProps} />
    );
    expect(screen.getByText("Saving…")).toBeTruthy();
    expect(screen.queryByText("Not saved: fix the colour.")).toBeNull();
  });

  it("offers an undo alongside a completed save when one is available", () => {
    const onUndo = jest.fn();
    render(<SaveStatus status="saved" onRetry={jest.fn()} onUndo={onUndo} mutedColor="#888" />);
    expect(screen.getByText("Saved")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Undo the last save"));
    expect(onUndo).toHaveBeenCalled();
  });

  it("shows no undo when there is nothing to put back", () => {
    render(<SaveStatus status="saved" onRetry={jest.fn()} onUndo={null} mutedColor="#888" />);
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.queryByText("Undo")).toBeNull();
  });

  it("does not offer an undo next to a failure", () => {
    render(
      <SaveStatus
        status="error"
        error="Nope."
        onRetry={jest.fn()}
        onUndo={jest.fn()}
        mutedColor="#888"
      />
    );
    expect(screen.getByText("Nope.")).toBeTruthy();
    expect(screen.queryByText("Undo")).toBeNull();
  });
});
