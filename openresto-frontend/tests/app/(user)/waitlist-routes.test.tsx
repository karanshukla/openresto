import React from "react";
import { render, screen } from "@testing-library/react-native";
import WaitlistStatusRoute from "@/app/(user)/(bookings)/waitlist/[ref]";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams }));

jest.mock("@/components/waitlist/WaitlistStatusScreen", () => ({
  __esModule: true,
  default: ({ entryRef }: { entryRef: string }) => {
    const { Text } = require("react-native");
    return <Text>{`status:${entryRef}`}</Text>;
  },
}));

describe("waitlist routes", () => {
  it("hands the status screen the ref from the email link", () => {
    mockParams = { ref: "abc234" };
    render(<WaitlistStatusRoute />);
    expect(screen.getByText("status:abc234")).toBeTruthy();
  });
});
