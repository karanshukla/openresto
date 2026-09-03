import React from "react";
import { render, screen } from "@testing-library/react-native";
import GuestTabs from "@/components/layout/GuestTabs.web";

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Slot: () => React.createElement(View, { testID: "slot" }) };
});

// The web build resolves `GuestTabs` to this file so the native tab bar's web implementation
// stays out of a bundle that never mounts it. The guest layout never renders it on web, but if
// anything does, the routes go straight through rather than into a second tab bar.
describe("GuestTabs on web", () => {
  it("passes the routes straight through", () => {
    render(<GuestTabs />);

    expect(screen.getByTestId("slot")).toBeTruthy();
  });
});
