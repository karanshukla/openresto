import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BookingLookupBar } from "@/components/admin/bookings/BookingLookupBar";
import { registerFocusTarget, unregisterFocusTarget } from "@/utils/focusRegistry";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/utils/focusRegistry", () => ({
  registerFocusTarget: jest.fn(),
  unregisterFocusTarget: jest.fn(),
}));

const theme = {
  borderColor: "#ddd",
  inputBg: "#fff",
  textColor: "#000",
  placeholderColor: "#999",
  primaryColor: "#0a7ea4",
};

describe("BookingLookupBar", () => {
  it("renders the input with placeholder + Find button", () => {
    render(
      <BookingLookupBar
        query=""
        loading={false}
        status="idle"
        onQueryChange={() => {}}
        onSubmit={() => {}}
        {...theme}
      />
    );
    expect(screen.getByPlaceholderText("Name, email or reference…")).toBeTruthy();
    expect(screen.getByText("Find")).toBeTruthy();
  });

  it("fires onQueryChange when the input changes", () => {
    const onQueryChange = jest.fn();
    render(
      <BookingLookupBar
        query=""
        loading={false}
        status="idle"
        onQueryChange={onQueryChange}
        onSubmit={() => {}}
        {...theme}
      />
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Name, email or reference…"),
      "alice@test.com"
    );
    expect(onQueryChange).toHaveBeenCalledWith("alice@test.com");
  });

  it("fires onSubmit when the Find button is pressed", () => {
    const onSubmit = jest.fn();
    render(
      <BookingLookupBar
        query="alice@test.com"
        loading={false}
        status="idle"
        onQueryChange={() => {}}
        onSubmit={onSubmit}
        {...theme}
      />
    );
    fireEvent.press(screen.getByText("Find"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows the not-found message when status is 'not_found'", () => {
    render(
      <BookingLookupBar
        query="nobody@test.com"
        loading={false}
        status="not_found"
        onQueryChange={() => {}}
        onSubmit={() => {}}
        {...theme}
      />
    );
    expect(screen.getByText("No booking found.")).toBeTruthy();
  });

  it("shows the multiple-matches message when status is 'multiple'", () => {
    render(
      <BookingLookupBar
        query="smith"
        loading={false}
        status="multiple"
        onQueryChange={() => {}}
        onSubmit={() => {}}
        {...theme}
      />
    );
    expect(screen.getByText("Showing all matches…")).toBeTruthy();
  });

  it("marks the Find button busy and inert while loading", () => {
    const onSubmit = jest.fn();
    render(
      <BookingLookupBar
        query="x"
        loading
        status="idle"
        onQueryChange={() => {}}
        onSubmit={onSubmit}
        {...theme}
      />
    );
    // The button keeps its name while busy — the spinner sits beside the label rather
    // than replacing it, so the control never goes anonymous mid-request.
    const find = screen.getByLabelText("Find booking");
    expect(find.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    fireEvent.press(find);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("owns the admin lookup focus target while mounted", () => {
    const { unmount } = render(
      <BookingLookupBar
        query=""
        loading={false}
        status="idle"
        onQueryChange={() => {}}
        onSubmit={() => {}}
        {...theme}
      />
    );
    const [key, ref] = (registerFocusTarget as jest.Mock).mock.calls[0];
    expect(key).toBe("admin-lookup");
    expect(ref.current).toBe(screen.getByPlaceholderText("Name, email or reference…").instance);

    unmount();
    expect(unregisterFocusTarget).toHaveBeenCalledWith("admin-lookup");
  });
});
