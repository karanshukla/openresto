/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Platform, StyleSheet, Text } from "react-native";
import SlidePanel from "@/components/common/SlidePanel";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
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

/** The platform sheet's props, which is where the native branch's behaviour is observable. */
const sheetProps = () =>
  screen.UNSAFE_getByType(BottomSheetModal as unknown as React.ComponentType).props as Record<
    string,
    // eslint-disable-next-line typescript/no-explicit-any
    any
  >;

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

  /**
   * The website's own sheet. Off web this whole shell is replaced by the platform's, so every
   * assertion about a grabber, a backdrop or a pan responder belongs here.
   */
  describe("sheet variant on web", () => {
    let originalOS: string;
    beforeEach(() => {
      originalOS = Platform.OS;
      (Platform as unknown as { OS: string }).OS = "web";
    });
    afterEach(() => {
      (Platform as unknown as { OS: string }).OS = originalOS;
    });

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

    /**
     * The card is the part under the thumb, so the whole sheet answers a drag and not just the
     * handle. Which drags it claims is `shouldClaimSheetDrag`, pinned in panelMotion's own test;
     * what this pins is the wiring, since a gate nothing consults changes nothing.
     */
    it("lets the sheet itself claim a drag, ahead of the body's scroller", () => {
      renderWithProviders(
        <SlidePanel variant="sheet" onDismiss={jest.fn()} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );

      expect(
        screen.getByTestId("result-panel").props.onMoveShouldSetResponderCapture
      ).toBeDefined();
    });

    // The gate reads the scroll position, so the body has to report it.
    it("tracks how far the body has scrolled", () => {
      renderWithProviders(
        <SlidePanel variant="sheet" onDismiss={jest.fn()} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );
      const body = screen.getByTestId("result-panel-body");

      expect(typeof body.props.onScroll).toBe("function");
      expect(body.props.scrollEventThrottle).toBe(16);
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

    it("adds nothing under the body on web", () => {
      const original = Platform.OS;
      (Platform as unknown as { OS: string }).OS = "web";
      try {
        renderWithInsets(
          { bottom: 34 },
          <SlidePanel variant="sheet" onDismiss={jest.fn()} accessibilityLabel="Booking result">
            <Text>Panel content</Text>
          </SlidePanel>
        );

        expect(screen.queryByTestId("result-panel-bottom-inset")).toBeNull();
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

  /**
   * Off web the panel is the platform's own sheet. The hand-rolled Modal never dragged on a
   * device — not by its body, not by its handle — so the guest could only leave through the
   * backdrop. These pin the handover rather than the sheet's internals, which are
   * `NativeSheet`'s own tests.
   */
  describe("sheet variant off web", () => {
    let originalOS: string;
    beforeEach(() => {
      originalOS = Platform.OS;
      (Platform as unknown as { OS: string }).OS = "ios";
    });
    afterEach(() => {
      (Platform as unknown as { OS: string }).OS = originalOS;
    });

    const renderSheet = (onDismiss = jest.fn()) => {
      renderWithProviders(
        <SlidePanel variant="sheet" onDismiss={onDismiss} accessibilityLabel="Booking result">
          <Text>Panel content</Text>
        </SlidePanel>
      );
      return onDismiss;
    };

    it("hands the body to the platform sheet", () => {
      renderSheet();

      expect(screen.getByText("Panel content")).toBeTruthy();
    });

    // Two backdrops and two handles would stack; the platform sheet brings its own of each.
    it("drops the hand-rolled chrome", () => {
      renderSheet();

      expect(
        screen.queryByTestId("result-panel-backdrop", { includeHiddenElements: true })
      ).toBeNull();
      expect(
        screen.queryByTestId("result-panel-grabber", { includeHiddenElements: true })
      ).toBeNull();
    });

    it("reports a dismissal upward exactly once", () => {
      const onDismiss = renderSheet();

      sheetProps().onDismiss();

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    // The panel carries no close button, so a drag that does not dismiss traps the guest in it.
    it("can be dragged down to dismiss", () => {
      renderSheet();

      expect(sheetProps().enablePanDownToClose).toBe(true);
    });
  });
});
