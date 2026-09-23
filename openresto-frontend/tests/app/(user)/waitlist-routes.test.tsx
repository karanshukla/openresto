import React from "react";
import { render, screen } from "@testing-library/react-native";
import JoinWaitlistRoute from "@/app/(user)/(locations)/join-waitlist/[restaurantId]";
import WaitlistStatusRoute from "@/app/(user)/(bookings)/waitlist/[ref]";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams }));

jest.mock("@/components/waitlist/JoinWaitlistScreen", () => ({
  __esModule: true,
  default: ({ restaurantId }: { restaurantId: number }) => {
    const { Text } = require("react-native");
    return <Text>{`join:${typeof restaurantId}:${restaurantId}`}</Text>;
  },
}));
jest.mock("@/components/waitlist/WaitlistStatusScreen", () => ({
  __esModule: true,
  default: ({ entryRef }: { entryRef: string }) => {
    const { Text } = require("react-native");
    return <Text>{`status:${entryRef}`}</Text>;
  },
}));

describe("waitlist routes", () => {
  it("hands the join screen the location id as a number", () => {
    mockParams = { restaurantId: "7" };
    render(<JoinWaitlistRoute />);
    expect(screen.getByText("join:number:7")).toBeTruthy();
  });

  it("hands the status screen the ref from the email link", () => {
    mockParams = { ref: "abc234" };
    render(<WaitlistStatusRoute />);
    expect(screen.getByText("status:abc234")).toBeTruthy();
  });
});
