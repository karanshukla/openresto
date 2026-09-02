/**
 * @jest-environment jsdom
 *
 * The root error boundary. Two things here are easy to regress and both are user-visible:
 * the raw `error.message` must never reach a production build (it can leak internals), and
 * `logError` must fire from an effect rather than during render so a re-render storm doesn't
 * multiply reports.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ErrorBoundary } from "@/components/common/RootErrorBoundary";
import { logError } from "@/services/errorReporting";

jest.mock("@/services/errorReporting", () => ({ logError: jest.fn() }));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

const renderBoundary = (error: Error, retry = jest.fn()) => {
  // ErrorBoundaryProps types `retry` as returning Promise<void>; the component wraps the call
  // in `void retry()` so a sync test double is fine at runtime.
  render(<ErrorBoundary error={error} retry={retry as never} />);
  return retry;
};

describe("root ErrorBoundary", () => {
  it("renders the generic fallback title", () => {
    renderBoundary(new Error("boom"));
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("reports the error to the error sink with the boundary tag", () => {
    const error = new Error("boom");
    renderBoundary(error);
    expect(logError).toHaveBeenCalledWith(error, { boundary: "root-error-boundary" });
  });

  it("reports once per render, not per commit", () => {
    renderBoundary(new Error("boom"));
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("shows the raw error message outside production", () => {
    process.env.NODE_ENV = "development";
    renderBoundary(new Error("connection refused at 10.0.0.4:5432"));
    expect(screen.getByText("connection refused at 10.0.0.4:5432")).toBeTruthy();
  });

  it("hides the raw error message in production", () => {
    process.env.NODE_ENV = "production";
    renderBoundary(new Error("connection refused at 10.0.0.4:5432"));
    expect(screen.queryByText("connection refused at 10.0.0.4:5432")).toBeNull();
    // Falls back to ErrorScreen's own default copy.
    expect(screen.getByText("An unexpected error occurred. Try again.")).toBeTruthy();
  });

  it("invokes retry when 'Try again' is pressed", () => {
    const retry = renderBoundary(new Error("boom"));
    fireEvent.press(screen.getByLabelText("Try again"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("navigates home when 'Go to home' is pressed", () => {
    renderBoundary(new Error("boom"));
    fireEvent.press(screen.getByLabelText("Go to home"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
