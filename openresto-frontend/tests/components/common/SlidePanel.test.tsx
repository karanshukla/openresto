/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Platform, StyleSheet, Text } from "react-native";
import SlidePanel from "@/components/common/SlidePanel";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { renderWithInsets } from "@/tests/helpers/renderWithInsets";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

// The sheet variant renders inside a Modal; render its children inline so tests can reach them.
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

jest.mock("@/utils/webAnimation", () => ({
  ...jest.requireActual("@/utils/webAnimation"),
  animateNode: jest.fn(() => null),
}));
const mockAnimateNode = jest.requireMock("@/utils/webAnimation").animateNode as jest.Mock;

describe("SlidePanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("side variant", () => {
    it("renders its children with no backdrop or grabber", () => {
      renderWithProviders(
        <SlidePanel variant="side" onDismiss={jest.fn()} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );
      expect(screen.getByText("Panel content")).toBeTruthy();
      expect(screen.queryByTestId("result-panel-backdrop")).toBeNull();
      expect(screen.queryByTestId("result-panel-grabber")).toBeNull();
    });

    it("plays the entrance animation once on mount", () => {
      renderWithProviders(
        <SlidePanel variant="side" onDismiss={jest.fn()} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );
      expect(mockAnimateNode).toHaveBeenCalledTimes(1);
    });
  });

  describe("sheet variant", () => {
    it("renders inside the sheet shell with a grabber and backdrop", () => {
      renderWithProviders(
        <SlidePanel variant="sheet" onDismiss={jest.fn()} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );
      expect(screen.getByTestId("result-panel")).toBeTruthy();
      expect(screen.getByText("Panel content")).toBeTruthy();
      expect(
        screen.getByTestId("result-panel-grabber", { includeHiddenElements: true })
      ).toBeTruthy();
    });

    it("does not replay the side entrance animation", () => {
      renderWithProviders(
        <SlidePanel variant="sheet" onDismiss={jest.fn()} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );
      expect(mockAnimateNode).not.toHaveBeenCalled();
    });

    it("dismisses when the backdrop is tapped, after the sheet has slid away", async () => {
      const onDismiss = jest.fn();
      renderWithProviders(
        <SlidePanel variant="sheet" onDismiss={onDismiss} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );
      fireEvent.press(screen.getByTestId("result-panel-backdrop", { includeHiddenElements: true }));
      await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    });

    it("wires the grabber to a pan responder, hidden from assistive tech", () => {
      renderWithProviders(
        <SlidePanel variant="sheet" onDismiss={jest.fn()} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );
      const grabber = screen.getByTestId("result-panel-grabber", { includeHiddenElements: true });
      expect(grabber.props.onStartShouldSetResponder).toBeDefined();
      expect(grabber.props.onMoveShouldSetResponder).toBeDefined();
      expect(grabber.props.accessibilityElementsHidden).toBe(true);
    });

    /**
     * The sheet is the bottom of the screen: without stepping up over the home indicator its
     * last row sits under it. Web has no inset to clear and stays exactly as it was.
     */
    it("clears the bottom safe area off web", () => {
      const original = Platform.OS;
      (Platform as unknown as { OS: string }).OS = "ios";
      try {
        renderWithInsets(
          { bottom: 34 },
          <SlidePanel variant="sheet" onDismiss={jest.fn()} accessibilityLabel="Booking result">
            <Text>Panel content</Text>
          </SlidePanel>
        );
        const sheet = StyleSheet.flatten(screen.getByTestId("result-panel").props.style);
        expect(sheet.paddingBottom).toBe(34);
      } finally {
        (Platform as unknown as { OS: string }).OS = original;
      }
    });

    /**
     * No scrim: the page behind a sheet is not dimmed. On a device the Modal animates its
     * whole content, so a tinted backdrop slid up alongside the sheet as a separate black
     * layer and cost a full-screen translucent pass on every frame of it.
     */
    it("keeps the backdrop transparent, a press target and nothing more", () => {
      renderWithProviders(
        <SlidePanel variant="sheet" onDismiss={jest.fn()} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );
      const backdrop = StyleSheet.flatten(
        screen.getByTestId("result-panel-backdrop", { includeHiddenElements: true }).props.style
      );
      expect(backdrop.backgroundColor).toBe("transparent");
    });

    it("adds no inset on web", () => {
      const original = Platform.OS;
      (Platform as unknown as { OS: string }).OS = "web";
      try {
        renderWithInsets(
          { bottom: 34 },
          <SlidePanel variant="sheet" onDismiss={jest.fn()} accessibilityLabel="Booking result">
            <Text>Panel content</Text>
          </SlidePanel>
        );
        const sheet = StyleSheet.flatten(screen.getByTestId("result-panel").props.style);
        expect(sheet.paddingBottom).toBeUndefined();
      } finally {
        (Platform as unknown as { OS: string }).OS = original;
      }
    });

    it("uses a custom testID prefix when given one", () => {
      renderWithProviders(
        <SlidePanel
          variant="sheet"
          onDismiss={jest.fn()}
          accessibilityLabel="Booking result"
          testID="custom-panel"
        >
          <Text>Panel content</Text>
        </SlidePanel>
      );
      expect(screen.getByTestId("custom-panel")).toBeTruthy();
      expect(
        screen.getByTestId("custom-panel-backdrop", { includeHiddenElements: true })
      ).toBeTruthy();
    });
  });
});
