/**
 * @jest-environment jsdom
 */
import { Platform } from "react-native";
import {
  forgetWaitlistTicket,
  readWaitlistTickets,
  rememberWaitlistTicket,
} from "@/utils/waitlistTickets";

const KEY = "openresto.waitlistTickets";
const original = Platform.OS;

beforeEach(() => {
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  localStorage.clear();
});

afterAll(() => Object.defineProperty(Platform, "OS", { value: original, configurable: true }));

describe("waitlistTickets", () => {
  it("holds one ticket per location, the newest replacing the last", () => {
    rememberWaitlistTicket(3, "old");
    rememberWaitlistTicket(5, "other");

    expect(rememberWaitlistTicket(3, "new")).toEqual({ 3: "new", 5: "other" });
    expect(readWaitlistTickets()).toEqual({ 3: "new", 5: "other" });
  });

  it("forgets one location's ticket and keeps the rest", () => {
    rememberWaitlistTicket(3, "a");
    rememberWaitlistTicket(5, "b");

    expect(forgetWaitlistTicket(3)).toEqual({ 5: "b" });
    expect(readWaitlistTickets()).toEqual({ 5: "b" });
  });

  it.each(["not json", "[]", "null"])("reads %s as no tickets", (raw) => {
    localStorage.setItem(KEY, raw);
    expect(readWaitlistTickets()).toEqual({});
  });
});
