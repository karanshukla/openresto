import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeBookingSheet } from "@/components/booking/NativeBookingSheet.native";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

const sheetProps = () =>
  screen.UNSAFE_getByType(BottomSheetModal as unknown as React.ComponentType).props as Record<
    string,
    unknown
  >;

describe("NativeBookingSheet", () => {
  const renderSheet = (onClose = jest.fn()) => {
    render(
      <NativeBookingSheet accessibilityLabel="Book Toronto Resto" onClose={onClose}>
        {({ dismiss }) => (
          <Pressable testID="close" onPress={dismiss}>
            <Text>body</Text>
          </Pressable>
        )}
      </NativeBookingSheet>
    );
    return onClose;
  };

  it("renders the body it is given", () => {
    renderSheet();
    expect(screen.getByText("body")).toBeTruthy();
  });

  /**
   * Two detents: enough of the form to fill in without moving, and near-full for the seating
   * picker. One would make this a fixed panel with a drag handle, which is the thing the
   * hand-rolled sheet already was.
   */
  it("offers two detents and opens on the shorter one", () => {
    renderSheet();

    expect(sheetProps().snapPoints).toEqual(["66%", "92%"]);
    // Explicit detents and content sizing are mutually exclusive; leaving dynamic sizing on
    // makes the sheet ignore the snap points it was given.
    expect(sheetProps().enableDynamicSizing).toBe(false);
  });

  it("resizes around the keyboard rather than leaving it to a wrapper", () => {
    renderSheet();

    expect(sheetProps().keyboardBehavior).toBe("interactive");
    expect(sheetProps().android_keyboardInputMode).toBe("adjustResize");
  });

  it("can be dragged away", () => {
    renderSheet();
    expect(sheetProps().enablePanDownToClose).toBe(true);
  });

  // The drawer's close button asks the sheet to dismiss, and the sheet reports back once it
  // has animated away. Anything else drops the drawer out from under its own exit.
  it("reports a dismissal upward exactly once", async () => {
    const onClose = renderSheet();

    fireEvent.press(screen.getByTestId("close"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("carries the location name for assistive tech", () => {
    renderSheet();
    expect(sheetProps().accessibilityLabel).toBe("Book Toronto Resto");
  });
});
