import React from "react";
import { render, screen } from "@testing-library/react-native";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import { KeyboardAvoider } from "@/components/common/KeyboardAvoider";

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

const renderAvoider = () =>
  render(
    <KeyboardAvoider style={{ flex: 1 }}>
      <Text>form</Text>
    </KeyboardAvoider>
  );

describe("KeyboardAvoider", () => {
  it("renders its children untouched on web, where the browser handles the keyboard", () => {
    setPlatform("web");

    renderAvoider();

    expect(screen.getByText("form")).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(KeyboardAvoidingView)).toHaveLength(0);
  });

  it("pads the form clear of the keyboard on iOS, which overlays the window", () => {
    setPlatform("ios");

    renderAvoider();

    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe("padding");
  });

  it("leaves the behaviour to Android, which resizes the window itself", () => {
    setPlatform("android");

    renderAvoider();

    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
  });
});
