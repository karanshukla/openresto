import React from "react";
import { render } from "@testing-library/react-native";
import SearchRedirect from "@/app/(user)/search";

jest.mock("expo-router", () => ({
  Redirect: jest.fn(() => null),
}));

describe("SearchRedirect", () => {
  it("renders redirect to home", () => {
    const { Redirect } = require("expo-router");
    render(<SearchRedirect />);
    expect(Redirect).toHaveBeenCalledWith({ href: "/" }, undefined);
  });
});
