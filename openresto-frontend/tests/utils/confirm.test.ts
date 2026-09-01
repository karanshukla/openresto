/**
 * @jest-environment jsdom
 */
import { Alert, Platform } from "react-native";
import { confirm } from "@/utils/confirm";

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

/** The buttons the last Alert.alert call offered, by label. */
function alertButtons(spy: jest.SpyInstance) {
  const [, , buttons] = spy.mock.calls[0] as unknown as [
    string,
    string | undefined,
    { text: string; style?: string; onPress?: () => void }[],
    { onDismiss?: () => void },
  ];
  return buttons;
}

describe("confirm (web)", () => {
  beforeEach(() => setPlatform("web"));

  it("resolves true when the browser confirm is accepted", async () => {
    (window as unknown as { confirm: jest.Mock }).confirm = jest.fn(() => true);
    await expect(confirm("Sure?")).resolves.toBe(true);
    expect(window.confirm).toHaveBeenCalledWith("Sure?");
  });

  it("resolves false when the browser confirm is dismissed", async () => {
    (window as unknown as { confirm: jest.Mock }).confirm = jest.fn(() => false);
    await expect(confirm("Sure?")).resolves.toBe(false);
  });
});

describe("confirm (native)", () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    setPlatform("ios");
    spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => spy.mockRestore());

  it("asks through Alert.alert, with the question as the title", async () => {
    const answer = confirm("Sure?");
    expect(spy.mock.calls[0][0]).toBe("Sure?");
    alertButtons(spy)[1].onPress?.();
    await expect(answer).resolves.toBe(true);
  });

  it("resolves false when the cancel button is pressed", async () => {
    const answer = confirm("Sure?");
    const [cancel] = alertButtons(spy);
    expect(cancel.style).toBe("cancel");
    cancel.onPress?.();
    await expect(answer).resolves.toBe(false);
  });

  it("resolves false when the alert is dismissed without a choice", async () => {
    // Android's back gesture. A dismissed browser confirm reads as "no", so this does too.
    const answer = confirm("Sure?");
    const options = spy.mock.calls[0][3] as { onDismiss?: () => void };
    options.onDismiss?.();
    await expect(answer).resolves.toBe(false);
  });

  it("labels the buttons in the UI language, not the device's", async () => {
    const answer = confirm("Sure?");
    expect(alertButtons(spy).map((b) => b.text)).toEqual(["Cancel", "Confirm"]);
    alertButtons(spy)[0].onPress?.();
    await answer;
  });
});
