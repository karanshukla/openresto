import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import HoldStatusBanner from "@/components/booking/HoldStatusBanner";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("HoldStatusBanner", () => {
  it("returns null when hasSelection is false", () => {
    const { toJSON } = render(
      <HoldStatusBanner holdStatus="idle" secondsLeft={0} hasSelection={false} />
    );
    expect(toJSON()).toBeNull();
  });

  it("returns null for idle status with selection", () => {
    const { toJSON } = render(
      <HoldStatusBanner holdStatus="idle" secondsLeft={0} hasSelection={true} />
    );
    expect(toJSON()).toBeNull();
  });

  it("shows loading text for pending status", () => {
    render(<HoldStatusBanner holdStatus="pending" secondsLeft={0} hasSelection={true} />);
    expect(screen.getByText("Checking availability…")).toBeTruthy();
  });

  it("shows countdown for held status", () => {
    render(<HoldStatusBanner holdStatus="held" secondsLeft={185} hasSelection={true} />);
    expect(screen.getByText(/Table held — expires in 3:05/)).toBeTruthy();
  });

  it("shows unavailable message", () => {
    render(<HoldStatusBanner holdStatus="unavailable" secondsLeft={0} hasSelection={true} />);
    expect(screen.getByText(/Table not available/)).toBeTruthy();
  });

  it("shows expired message with refresh button", () => {
    const onRefresh = jest.fn();
    render(
      <HoldStatusBanner
        holdStatus="expired"
        secondsLeft={0}
        hasSelection={true}
        onRefresh={onRefresh}
      />
    );
    expect(screen.getByText(/table hold expired/i)).toBeTruthy();
    fireEvent.press(screen.getByText("Refresh page"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows expired message without refresh button when onRefresh not provided", () => {
    render(<HoldStatusBanner holdStatus="expired" secondsLeft={0} hasSelection={true} />);
    expect(screen.getByText(/table hold expired/i)).toBeTruthy();
    expect(screen.queryByText("Refresh page")).toBeNull();
  });
});
