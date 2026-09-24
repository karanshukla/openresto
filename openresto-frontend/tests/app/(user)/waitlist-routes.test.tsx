import React from "react";
import { render, screen } from "@testing-library/react-native";
import WaitlistStatusRoute from "@/app/(user)/(bookings)/waitlist/[ref]";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams }));

jest.mock("@/components/booking/LookupScreen", () => ({
  __esModule: true,
  default: ({ initialTicketRef }: { initialTicketRef: string }) => {
    const { Text } = require("react-native");
    return <Text>{`ticket:${initialTicketRef}`}</Text>;
  },
}));

describe("waitlist routes", () => {
  it("opens the email link's ticket in My bookings", () => {
    mockParams = { ref: "abc234" };
    render(<WaitlistStatusRoute />);
    expect(screen.getByText("ticket:abc234")).toBeTruthy();
  });
});
