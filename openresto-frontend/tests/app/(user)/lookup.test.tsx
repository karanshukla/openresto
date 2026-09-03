/**
 * @jest-environment jsdom
 *
 * /lookup is a thin wrapper around LookupScreen (which has its own tests). What's worth
 * pinning here is the wiring this file owns: parsing `?ref=&email=` off the URL into
 * initialRef/initialEmail.
 */
import React from "react";
import { render } from "@testing-library/react-native";

let mockParams: Record<string, string | undefined> = {};
let mockScreenProps: { initialRef?: string; initialEmail?: string } = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/components/booking/LookupScreen", () => ({
  __esModule: true,
  default: (props: { initialRef?: string; initialEmail?: string }) => {
    mockScreenProps = props;
    return null;
  },
}));

import LookupRouteScreen from "@/app/(user)/(bookings)/lookup";

beforeEach(() => {
  mockParams = {};
  mockScreenProps = {};
});

describe("LookupRouteScreen", () => {
  it("renders LookupScreen with no deep-link props when the URL carries none", () => {
    render(<LookupRouteScreen />);
    expect(mockScreenProps).toEqual({ initialRef: undefined, initialEmail: undefined });
  });

  it("passes ref and email through as initialRef/initialEmail", () => {
    mockParams = { ref: "crispy-basil-thyme", email: "sam@example.com" };
    render(<LookupRouteScreen />);
    expect(mockScreenProps).toEqual({
      initialRef: "crispy-basil-thyme",
      initialEmail: "sam@example.com",
    });
  });

  it("treats an empty-string param as absent", () => {
    mockParams = { ref: "", email: "" };
    render(<LookupRouteScreen />);
    expect(mockScreenProps).toEqual({ initialRef: undefined, initialEmail: undefined });
  });
});
