/**
 * @jest-environment jsdom
 */
import { Platform } from "react-native";
import { forgetReminder, rememberReminder, reminderEndpointFor } from "@/utils/reminderRegistry";

Object.defineProperty(Platform, "OS", { value: "web", configurable: true });

beforeEach(() => {
  localStorage.clear();
});

describe("reminderRegistry", () => {
  it("knows nothing about a booking until it is remembered", () => {
    expect(reminderEndpointFor("ref-1")).toBeNull();
    rememberReminder("ref-1", "ExponentPushToken[1]");
    expect(reminderEndpointFor("ref-1")).toBe("ExponentPushToken[1]");
  });

  it("forgets one booking and leaves the others", () => {
    rememberReminder("ref-1", "a");
    rememberReminder("ref-2", "b");
    forgetReminder("ref-1");
    expect(reminderEndpointFor("ref-1")).toBeNull();
    expect(reminderEndpointFor("ref-2")).toBe("b");
  });

  it("reads a corrupt or non-object store as empty", () => {
    localStorage.setItem("openresto.reminders", "{not json");
    expect(reminderEndpointFor("ref-1")).toBeNull();
    localStorage.setItem("openresto.reminders", "[1,2]");
    expect(reminderEndpointFor("ref-1")).toBeNull();
    localStorage.setItem("openresto.reminders", "null");
    expect(reminderEndpointFor("ref-1")).toBeNull();
  });
});
