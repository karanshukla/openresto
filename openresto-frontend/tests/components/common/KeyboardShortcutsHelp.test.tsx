/**
 * @jest-environment ./jest-mocks/jsdomEnvironment.js
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import TestRenderer from "react-test-renderer";
import { Modal } from "react-native";
import KeyboardShortcutsHelp from "@/components/common/KeyboardShortcutsHelp";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("KeyboardShortcutsHelp", () => {
  it("lists the admin shortcuts when scope is admin", () => {
    render(<KeyboardShortcutsHelp visible scope="admin" onClose={jest.fn()} />);
    expect(screen.getByText(/Go to Dashboard/i)).toBeTruthy();
    expect(screen.queryByText(/Jump to the Find My Booking lookup/i)).toBeNull();
  });

  it("lists the user shortcuts when scope is user, without a '/' entry", () => {
    render(<KeyboardShortcutsHelp visible scope="user" onClose={jest.fn()} />);
    expect(screen.getByText(/Jump to the Find My Booking lookup/i)).toBeTruthy();
    expect(screen.queryByText(/Go to Dashboard/i)).toBeNull();
    expect(screen.queryByText("/")).toBeNull();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsHelp visible scope="admin" onClose={onClose} />);
    fireEvent.press(screen.getByTestId("keyboard-shortcuts-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is pressed", () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsHelp visible scope="admin" onClose={onClose} />);
    fireEvent.press(screen.getByTestId("keyboard-shortcuts-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // See tests/components/common/ModalEscapeRegression.test.tsx for why this
  // checks onRequestClose wiring rather than dispatching a real keyup: Jest in
  // this repo renders via react-test-renderer (real react-native), not
  // react-native-web, so the DOM-level Escape listener isn't reachable here —
  // it's exercised by the browser at runtime instead. Wiring onRequestClose to
  // onClose is the only precondition this component controls.
  it("wires onRequestClose to onClose, the precondition for web Escape-to-close", () => {
    const onClose = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(<KeyboardShortcutsHelp visible scope="admin" onClose={onClose} />);
    });

    const modal = tree.root.findByType(Modal);
    expect(modal.props.onRequestClose).toBe(onClose);
  });
});
