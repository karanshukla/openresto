import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BookingSheetHost } from "@/components/booking/BookingSheetHost.native";

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  return { GestureHandlerRootView: View };
});

describe("BookingSheetHost (native)", () => {
  it("renders its children", () => {
    render(
      <BookingSheetHost>
        <Text>content</Text>
      </BookingSheetHost>
    );

    expect(screen.getByText("content")).toBeTruthy();
  });

  /**
   * The provider renders the sheets and the sheets are gesture-driven, so a provider mounted
   * above the gesture root would put every sheet outside the tree that feeds it touches.
   */
  it("puts the gesture root outside the sheet provider", () => {
    render(
      <BookingSheetHost>
        <Text>content</Text>
      </BookingSheetHost>
    );

    const root = screen.UNSAFE_getByType(GestureHandlerRootView);
    expect(root).toBeTruthy();
    expect(root.findByType(Text)).toBeTruthy();
  });
});
