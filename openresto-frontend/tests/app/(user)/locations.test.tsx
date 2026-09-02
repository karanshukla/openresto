/**
 * @jest-environment jsdom
 *
 * The two Locations routes are thin wrappers around `LocationsScreen` (which has its own tests).
 * What is worth pinning here is the wiring they own: the `Stack.Screen` title each sets, and the
 * deep-link param parsing in `locations/[id]` — the `party` clamp and the `Number.isFinite` guard
 * are the only logic in either file, and both silently mis-prefill the booking form when wrong.
 *
 * The capture variables are `mock`-prefixed because Jest only allows out-of-scope references
 * inside a `jest.mock` factory for names matching that prefix.
 */
import React from "react";
import { render } from "@testing-library/react-native";

let mockScreenOptions: { title?: string } | undefined;
let mockParams: Record<string, string | undefined> = {};
let mockScreenProps: {
  highlightId?: number;
  initialTime?: string;
  initialSeats?: number;
  hasNativeHeader?: boolean;
} = {};

jest.mock("expo-router", () => ({
  Stack: {
    Screen: ({ options }: { options: { title?: string } }) => {
      mockScreenOptions = options;
      return null;
    },
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/components/restaurant/LocationsScreen", () => ({
  __esModule: true,
  default: (props: { highlightId?: number; initialTime?: string; initialSeats?: number }) => {
    mockScreenProps = props;
    return null;
  },
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto" }),
}));

import LocationsIndexScreen from "@/app/(user)/locations/index";
import LocationsDetailScreen from "@/app/(user)/locations/[id]";

beforeEach(() => {
  mockScreenOptions = undefined;
  mockScreenProps = {};
  mockParams = {};
});

describe("LocationsIndexScreen", () => {
  it("titles the screen 'Locations'", () => {
    render(<LocationsIndexScreen />);
    expect(mockScreenOptions).toEqual({ title: "Locations" });
  });

  it("renders LocationsScreen with no deep-link props", () => {
    render(<LocationsIndexScreen />);
    expect(mockScreenProps).toEqual({});
  });
});

describe("LocationsDetailScreen", () => {
  it("titles the screen with the brand name", () => {
    mockParams = { id: "7" };
    render(<LocationsDetailScreen />);
    expect(mockScreenOptions).toEqual({ title: "Open Resto" });
  });

  // #428: the detail route is pushed over a tab root and so has a native header above it,
  // which is what decides whether the screen or the scroll view claims the top inset. The
  // index route is a tab root with no header, and the assertion above that its props are
  // empty is the other half of this pair.
  it("tells the screen a native header sits above it", () => {
    mockParams = { id: "7" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.hasNativeHeader).toBe(true);
  });

  it("passes the numeric id through as highlightId", () => {
    mockParams = { id: "7" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.highlightId).toBe(7);
  });

  it("passes undefined highlightId when the id is missing", () => {
    mockParams = {};
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.highlightId).toBeUndefined();
  });

  it("passes undefined highlightId when the id is not a number", () => {
    mockParams = { id: "not-a-number" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.highlightId).toBeUndefined();
  });

  it("forwards the time param", () => {
    mockParams = { id: "7", time: "19:30" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.initialTime).toBe("19:30");
  });

  it("passes undefined initialTime for an empty time param", () => {
    mockParams = { id: "7", time: "" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.initialTime).toBeUndefined();
  });

  it("forwards a party size within range", () => {
    mockParams = { id: "7", party: "4" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.initialSeats).toBe(4);
  });

  it("clamps a party size above the maximum to 10", () => {
    mockParams = { id: "7", party: "99" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.initialSeats).toBe(10);
  });

  it("clamps a party size below the minimum to 1", () => {
    mockParams = { id: "7", party: "0" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.initialSeats).toBe(1);
  });

  it("passes undefined initialSeats for an unparseable party param", () => {
    // parseInt returns NaN, and the `|| undefined` guard turns it into undefined rather than
    // prefilling the form with NaN.
    mockParams = { id: "7", party: "abc" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.initialSeats).toBeUndefined();
  });

  it("passes undefined initialSeats when the party param is absent", () => {
    mockParams = { id: "7" };
    render(<LocationsDetailScreen />);
    expect(mockScreenProps.initialSeats).toBeUndefined();
  });
});
