import React from "react";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { UndoBar, UNDO_BAR_MS } from "@/components/admin/tonight/UndoBar";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));

describe("UndoBar", () => {
  it("offers Undo when there is a move to take back", () => {
    const onUndo = jest.fn();
    renderWithProviders(<UndoBar message="T3 is free" onUndo={onUndo} onDismiss={jest.fn()} />);

    expect(screen.getByText("T3 is free")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Undo: T3 is free"));
    expect(onUndo).toHaveBeenCalled();
  });

  it("only confirms when there is nothing to take back", () => {
    renderWithProviders(<UndoBar message="Undone" onDismiss={jest.fn()} />);

    expect(screen.queryByTestId("undo-bar-undo")).toBeNull();
  });

  it("dismisses on the close button, and by itself after a while", () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    renderWithProviders(<UndoBar message="Done" onDismiss={onDismiss} />);

    fireEvent.press(screen.getByTestId("undo-bar-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(UNDO_BAR_MS));
    expect(onDismiss).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
