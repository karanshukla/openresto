/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react-native";
import BookRedirect from "@/app/(user)/book";

let capturedHref: string | undefined;

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  Redirect: ({ href }: { href: string }) => {
    capturedHref = href;
    return null;
  },
}));

import { useLocalSearchParams } from "expo-router";

describe("BookRedirect", () => {
  beforeEach(() => {
    capturedHref = undefined;
    jest.clearAllMocks();
  });

  it("redirects to /(user)/locations/[id] when restaurantId param is present", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ restaurantId: "42" });
    render(<BookRedirect />);
    expect(capturedHref).toBe("/(user)/locations/42");
  });

  it("redirects to / when restaurantId param is absent", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    render(<BookRedirect />);
    expect(capturedHref).toBe("/");
  });
});
