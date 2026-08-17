/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { AnchoredPanel } from "@/components/common/AnchoredPanel";
import { backdropStyleFor, panelStyleFor } from "@/components/common/AnchoredPanel.styles";

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    colors: { border: "#ccc", card: "#fff", muted: "#666", input: "#eee" },
    isDark: false,
    primaryColor: "#000",
  }),
}));

const renderPanel = (over: Partial<React.ComponentProps<typeof AnchoredPanel>> = {}) =>
  render(
    <AnchoredPanel
      visible
      onClose={jest.fn()}
      position={null}
      role="menu"
      accessibilityLabel="Options"
      closeLabel="Close the options list"
      backdropTestID="panel-backdrop"
      testID="panel"
      {...over}
    >
      <Text>A row</Text>
    </AnchoredPanel>
  );

describe("AnchoredPanel", () => {
  it("shows its contents when open and nothing when closed", () => {
    const { rerender } = renderPanel();
    expect(screen.getByText("A row")).toBeTruthy();

    rerender(
      <AnchoredPanel
        visible={false}
        onClose={jest.fn()}
        position={null}
        role="menu"
        accessibilityLabel="Options"
        closeLabel="Close the options list"
      >
        <Text>A row</Text>
      </AnchoredPanel>
    );

    expect(screen.queryByText("A row")).toBeNull();
  });

  it("closes on a press outside", () => {
    const onClose = jest.fn();
    renderPanel({ onClose });

    fireEvent.press(screen.getByTestId("panel-backdrop"));

    expect(onClose).toHaveBeenCalled();
  });

  /**
   * Without this, anything inside that does not consume a press — a separator, the padding
   * between rows, a disabled row — reaches the backdrop and dismisses the popup, which reads as
   * the control refusing to work rather than refusing that one row.
   */
  it("swallows a press that lands on the panel itself", () => {
    const onClose = jest.fn();
    renderPanel({ onClose });

    const stopPropagation = jest.fn();
    fireEvent.press(screen.getByTestId("panel"), { stopPropagation });

    expect(stopPropagation).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("forwards keystrokes to whoever owns the list", () => {
    const onKeyDown = jest.fn();
    renderPanel({ onKeyDown });

    screen.getByTestId("panel").props.onKeyDown({ key: "ArrowDown" });

    expect(onKeyDown).toHaveBeenCalledWith({ key: "ArrowDown" });
  });

  /**
   * The list is the keyboard's one target: it takes focus and moves an `aria-activedescendant`
   * highlight, rather than moving focus through however many rows it holds.
   */
  it("is the focus target itself, out of the tab order", () => {
    renderPanel({ activeDescendantId: "opt-2" });

    const panel = screen.getByTestId("panel");
    expect(panel.props.tabIndex).toBe(-1);
    expect(panel.props["aria-activedescendant"]).toBe("opt-2");
  });

  /**
   * The backdrop has to stay out of the tab order too, or the focus trap inside
   * react-native-web's Modal lands on it and every keystroke misses the list behind it.
   */
  it("keeps the backdrop out of the tab order", () => {
    renderPanel();

    expect(screen.getByTestId("panel-backdrop").props.tabIndex).toBe(-1);
  });
});

/**
 * The two shapes the panel takes. The anchored one is unreachable from a component test — under
 * react-test-renderer a ref never reports a box — so it is exercised through the style function
 * directly, and proven end to end in `e2e/admin-activity.spec.ts`.
 */
describe("shape", () => {
  /**
   * `justifyContent` is the tell, not `flex: 1` — both backdrops carry that, so asserting on it
   * passes against either branch. An earlier version of this test asserted `flex: 1` and passed
   * while rendering the centred sheet.
   */
  it("dims the page behind a centred sheet and not behind a dropdown", () => {
    expect(backdropStyleFor(false)).toHaveProperty("justifyContent", "center");
    expect(backdropStyleFor(true)).not.toHaveProperty("justifyContent");
  });

  it("hangs the panel off the measured trigger", () => {
    const anchored = panelStyleFor(
      { top: 146, left: 200, width: 240, maxHeight: 360 },
      "#ccc"
    ) as object[];

    expect(anchored).toContainEqual(
      expect.objectContaining({ top: 146, left: 200, width: 240, maxHeight: 360 })
    );
  });

  /**
   * A flipped panel is pinned by its bottom edge. Setting both would leave the undefined one
   * fighting the edge that matters and stretch the panel across the gap.
   */
  it("pins a flipped panel by its bottom edge alone", () => {
    const flipped = panelStyleFor(
      { bottom: 181, left: 200, width: 240, maxHeight: 360 },
      "#ccc"
    ) as object[];

    const positioned = flipped.find((s) => "bottom" in s)!;
    expect(positioned).toEqual(expect.objectContaining({ bottom: 181 }));
    expect(positioned).not.toHaveProperty("top");
  });

  it("centres the sheet when there is no anchor", () => {
    const centred = panelStyleFor(null, "#ccc") as object[];

    expect(centred).toContainEqual(expect.objectContaining({ borderColor: "#ccc" }));
    expect(centred.some((s) => "top" in s)).toBe(false);
  });
});
