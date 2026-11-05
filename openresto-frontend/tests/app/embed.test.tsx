/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react-native";
import EmbedScreen from "@/app/embed";

const mockParams = jest.fn();
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams() }));

const mockEmbedBooking = jest.fn((_props: { locationId?: number }) => null);
jest.mock("@/components/embed/EmbedBooking", () => ({
  __esModule: true,
  default: (props: { locationId?: number }) => mockEmbedBooking(props),
}));

describe("embed route", () => {
  it("pins the widget to the location in the query", () => {
    mockParams.mockReturnValue({ location: "3" });
    render(<EmbedScreen />);
    expect(mockEmbedBooking).toHaveBeenLastCalledWith({ locationId: 3 });
  });

  it.each([{}, { location: "abc" }])("pins nothing for %p", (params) => {
    mockParams.mockReturnValue(params);
    render(<EmbedScreen />);
    expect(mockEmbedBooking).toHaveBeenLastCalledWith({ locationId: undefined });
  });
});
