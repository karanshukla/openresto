/**
 * @jest-environment jsdom
 */
import React from "react";

jest.mock("expo-router/html", () => ({
  ScrollViewStyleReset: () => null,
}));

describe("+html Root", () => {
  it("exports a default React component function", () => {
    const { default: Root } = require("@/app/+html");
    expect(typeof Root).toBe("function");
  });

  it("renders a valid React element without crashing", () => {
    const { default: Root } = require("@/app/+html");
    const element = React.createElement(Root, {}, React.createElement("span", {}, "child"));
    expect(element).not.toBeNull();
    expect(element.type).toBe(Root);
  });
});
