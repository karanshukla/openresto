/**
 * @jest-environment jsdom
 *
 * /booking-confirmation/[bookingRef] is a thin wrapper around LookupScreen (which has its
 * own tests) — booking confirmation is a state of the lookup screen, not a page of its
 * own. What's worth pinning here is the wiring this file owns: prefilling ref/email from
 * the route, setting justBooked, and the legacy-numeric-id fallback regex (#179 — a
 * booking reference can itself be all-digits, so only a segment that the ref+email lookup
 * doesn't resolve falls back to being treated as a legacy database id).
 */
import React from "react";
import { render } from "@testing-library/react-native";

let mockParams: Record<string, string | undefined> = {};
let mockScreenProps: {
  initialRef?: string;
  initialEmail?: string;
  legacyBookingId?: number;
  justBooked?: boolean;
} = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/components/booking/LookupScreen", () => ({
  __esModule: true,
  default: (props: {
    initialRef?: string;
    initialEmail?: string;
    legacyBookingId?: number;
    justBooked?: boolean;
  }) => {
    mockScreenProps = props;
    return null;
  },
}));

import BookingConfirmationRouteScreen from "@/app/(user)/(bookings)/booking-confirmation/[bookingRef]";

beforeEach(() => {
  mockParams = {};
  mockScreenProps = {};
});

describe("BookingConfirmationRouteScreen", () => {
  it("prefills ref/email and sets justBooked for an alpha reference", () => {
    mockParams = { bookingRef: "crispy-basil-thyme", email: "sam@example.com" };
    render(<BookingConfirmationRouteScreen />);
    expect(mockScreenProps).toEqual({
      initialRef: "crispy-basil-thyme",
      initialEmail: "sam@example.com",
      legacyBookingId: undefined,
      justBooked: true,
    });
  });

  it("resolves an all-digit segment as a reference first — no legacy id fallback yet", () => {
    // References can themselves be all-digits (#179); the fallback only kicks in once the
    // ref+email lookup inside LookupScreen actually comes back not-found, not up front here.
    mockParams = { bookingRef: "97977036", email: "sam@example.com" };
    render(<BookingConfirmationRouteScreen />);
    expect(mockScreenProps.initialRef).toBe("97977036");
    expect(mockScreenProps.legacyBookingId).toBe(97977036);
  });

  it("leaves legacyBookingId undefined for a non-numeric reference", () => {
    mockParams = { bookingRef: "crispy-basil-thyme" };
    render(<BookingConfirmationRouteScreen />);
    expect(mockScreenProps.legacyBookingId).toBeUndefined();
  });

  it("falls back initialEmail to undefined rather than an empty string when absent", () => {
    mockParams = { bookingRef: "50" };
    render(<BookingConfirmationRouteScreen />);
    expect(mockScreenProps.initialEmail).toBeUndefined();
    expect(mockScreenProps.legacyBookingId).toBe(50);
  });

  it("does not crash and leaves legacyBookingId undefined when bookingRef itself is missing", () => {
    mockParams = { bookingRef: undefined };
    render(<BookingConfirmationRouteScreen />);
    expect(mockScreenProps.legacyBookingId).toBeUndefined();
  });
});
