import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AddLocationForm } from "@/components/admin/locations/AddLocationForm";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const theme = { isDark: false, mutedColor: "#888", primaryColor: "#0a7ea4" };

describe("AddLocationForm", () => {
  it("renders the input + Add + cancel affordances", () => {
    render(
      <AddLocationForm
        value=""
        saving={false}
        onValueChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
        {...theme}
      />
    );
    expect(screen.getByPlaceholderText("Location name (e.g. Downtown, Westside)")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("fires onValueChange when typing", () => {
    const onValueChange = jest.fn();
    render(
      <AddLocationForm
        value=""
        saving={false}
        onValueChange={onValueChange}
        onSubmit={() => {}}
        onCancel={() => {}}
        {...theme}
      />
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Location name (e.g. Downtown, Westside)"),
      "Downtown"
    );
    expect(onValueChange).toHaveBeenCalledWith("Downtown");
  });

  it("fires onSubmit when Add is pressed", () => {
    const onSubmit = jest.fn();
    render(
      <AddLocationForm
        value="Downtown"
        saving={false}
        onValueChange={() => {}}
        onSubmit={onSubmit}
        onCancel={() => {}}
        {...theme}
      />
    );
    fireEvent.press(screen.getByText("Add"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("fires onCancel when the close (×) button is pressed", () => {
    const onCancel = jest.fn();
    render(
      <AddLocationForm
        value=""
        saving={false}
        onValueChange={() => {}}
        onSubmit={() => {}}
        onCancel={onCancel}
        {...theme}
      />
    );
    fireEvent.press(screen.getByTestId("add-location-cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows 'Adding…' while saving", () => {
    render(
      <AddLocationForm
        value="X"
        saving
        onValueChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
        {...theme}
      />
    );
    expect(screen.getByText("Adding…")).toBeTruthy();
    expect(screen.queryByText("Add")).toBeNull();
  });
});
