import React from "react";
import { screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeSheet } from "@/components/common/NativeSheet.native";
import { renderWithInsets } from "@/tests/helpers/renderWithInsets";

const sheetProps = () =>
  screen.UNSAFE_getByType(BottomSheetModal as unknown as React.ComponentType).props as Record<
    string,
    // eslint-disable-next-line typescript/no-explicit-any
    any
  >;

const HOME_INDICATOR = 34;

describe("NativeSheet", () => {
  const renderSheet = (props: Partial<React.ComponentProps<typeof NativeSheet>> = {}) => {
    const onDismiss = props.onDismiss ?? jest.fn();
    renderWithInsets(
      { bottom: HOME_INDICATOR },
      <NativeSheet
        accessibilityLabel="Booking result"
        testID="sheet-body"
        {...props}
        onDismiss={onDismiss}
      >
        <Text>body</Text>
      </NativeSheet>
    );
    return onDismiss;
  };

  it("renders the body it is given", () => {
    renderSheet();

    expect(screen.getByText("body")).toBeTruthy();
  });

  /**
   * Sized to its content rather than to fixed detents: a panel that is one short card should
   * not open at three quarters of the display. Past the cap the body scrolls inside it.
   */
  it("sizes to its content, up to a cap", () => {
    renderSheet();

    expect(sheetProps().enableDynamicSizing).toBe(true);
    expect(sheetProps().maxDynamicContentSize).toBeGreaterThan(0);
  });

  it("takes the cap it is given", () => {
    renderSheet({ maxHeightRatio: 0.5 });
    const half = sheetProps().maxDynamicContentSize;
    screen.unmount();

    renderSheet({ maxHeightRatio: 1 });

    expect(sheetProps().maxDynamicContentSize).toBeGreaterThan(half);
  });

  // The panel carries no close button, so this is the guest's only way out.
  it("can be dragged down to dismiss", () => {
    renderSheet();

    expect(sheetProps().enablePanDownToClose).toBe(true);
  });

  it("reports a dismissal upward exactly once", () => {
    const onDismiss = renderSheet();

    sheetProps().onDismiss();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  /** A backdrop that only dims is a dead end on a sheet with no close button. */
  it("closes on the backdrop rather than merely dimming", () => {
    renderSheet();

    const backdrop = sheetProps().backdropComponent({});

    expect(backdrop.type).toBe(BottomSheetBackdrop);
    expect(backdrop.props.pressBehavior).toBe("close");
  });

  /**
   * The inset is the window's, not a tab's: the sheet is presented through the portal host in
   * `app/_layout.tsx`, which sits above the navigator, so what it steps over is the home
   * indicator. Without it the last row of the body sits under the handle.
   */
  it("steps the body up over the home indicator", () => {
    renderSheet();

    const body = StyleSheet.flatten(screen.getByTestId("sheet-body").props.contentContainerStyle);
    expect(body.paddingBottom).toBe(HOME_INDICATOR);
  });

  it("names itself for assistive tech", () => {
    renderSheet();

    expect(sheetProps().accessibilityLabel).toBe("Booking result");
  });

  it("draws the sheet on the theme's card surface", () => {
    renderSheet();

    expect(StyleSheet.flatten(sheetProps().backgroundStyle).backgroundColor).toBeTruthy();
    expect(StyleSheet.flatten(sheetProps().handleIndicatorStyle).backgroundColor).toBeTruthy();
  });
});
