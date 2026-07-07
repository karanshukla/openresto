import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BookingLookupBar } from "@/components/admin/bookings/BookingLookupBar";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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
    expect(screen.getByPlaceholderText("Email or reference…")).toBeTruthy();
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
    fireEvent.changeText(screen.getByPlaceholderText("Email or reference…"), "alice@test.com");
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

  it("shows an ActivityIndicator (no Find text) while loading", () => {
    render(
      <BookingLookupBar
        query="x"
        loading
        status="idle"
        onQueryChange={() => {}}
        onSubmit={() => {}}
        {...theme}
      />
    );
    // While loading, the "Find" text node is replaced by the spinner.
    expect(screen.queryByText("Find")).toBeNull();
  });
});
