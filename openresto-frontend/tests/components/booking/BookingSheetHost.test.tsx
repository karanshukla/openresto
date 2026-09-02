import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { BookingSheetHost } from "@/components/booking/BookingSheetHost";

// The website's sheet is still the hand-rolled one, so the gesture root and sheet provider
// that @gorhom/bottom-sheet needs have no business in the web tree.
describe("BookingSheetHost (web)", () => {
  it("passes its children straight through", () => {
    render(
      <BookingSheetHost>
        <Text>content</Text>
      </BookingSheetHost>
    );

    expect(screen.getByText("content")).toBeTruthy();
  });
});

// The web stub of the sheet itself is never rendered by the drawer on web, but it is what the
// web bundle links against, so it has to hand the body back rather than swallowing it.
describe("NativeBookingSheet (web stub)", () => {
  it("renders whatever the drawer gives it", () => {
    const { NativeBookingSheet } = require("@/components/booking/NativeBookingSheet");
    render(
      <NativeBookingSheet accessibilityLabel="Book" onClose={jest.fn()}>
        {() => <Text>body</Text>}
      </NativeBookingSheet>
    );

    expect(screen.getByText("body")).toBeTruthy();
  });
});
