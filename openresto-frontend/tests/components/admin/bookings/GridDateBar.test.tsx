import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { GridDateBar } from "@/components/admin/bookings/GridDateBar";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

describe("GridDateBar", () => {
  const onChangeDay = jest.fn();
  const onResetToToday = jest.fn();

  const props = {
    onChangeDay,
    onResetToToday,
    borderColor: "#ccc",
    primaryColor: "#0a7ea4",
  };

  beforeEach(() => jest.clearAllMocks());

  it("steps back a day when the previous chevron is pressed", () => {
    render(<GridDateBar {...props} date={new Date()} />);

    fireEvent.press(screen.getByTestId("grid-nav-prev"));

    expect(onChangeDay).toHaveBeenCalledWith(-1);
  });

  it("steps forward a day when the next chevron is pressed", () => {
    render(<GridDateBar {...props} date={new Date()} />);

    fireEvent.press(screen.getByTestId("grid-nav-next"));

    expect(onChangeDay).toHaveBeenCalledWith(1);
  });

  it("resets to today when the date label is pressed", () => {
    const notToday = new Date();
    notToday.setDate(notToday.getDate() + 3);
    render(<GridDateBar {...props} date={notToday} />);

    fireEvent.press(screen.getByText("tap for today"));

    expect(onResetToToday).toHaveBeenCalledTimes(1);
  });

  it("shows the jump-to-today hint for a date that is not today", () => {
    const notToday = new Date();
    notToday.setDate(notToday.getDate() + 3);
    render(<GridDateBar {...props} date={notToday} />);

    expect(screen.getByText("tap for today")).toBeTruthy();
  });

  it("hides the jump-to-today hint when the date is already today", () => {
    render(<GridDateBar {...props} date={new Date()} />);

    expect(screen.queryByText("tap for today")).toBeNull();
  });
});
