import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import {
  canRegisterForReminders,
  registerForReminders,
  REMINDER_CHANNEL_ID,
} from "@/services/pushRegistration.native";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "ExponentPushToken[abc]" }),
}));

jest.mock("expo-device", () => ({ isDevice: true }));

jest.mock("expo", () => ({ isRunningInExpoGo: jest.fn(() => false) }));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "proj-1" } } } },
}));

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

const mocked = Notifications as unknown as {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  getExpoPushTokenAsync: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  (Device as unknown as { isDevice: boolean }).isDevice = true;
  Constants.expoConfig!.extra = { eas: { projectId: "proj-1" } };
  (isRunningInExpoGo as jest.Mock).mockReturnValue(false);
  setPlatform("ios");
});

describe("canRegisterForReminders (native)", () => {
  it("is false on a simulator and without an EAS project id", () => {
    expect(canRegisterForReminders({})).toBe(true);
    (Device as unknown as { isDevice: boolean }).isDevice = false;
    expect(canRegisterForReminders({})).toBe(false);
    (Device as unknown as { isDevice: boolean }).isDevice = true;
    Constants.expoConfig!.extra = {};
    expect(canRegisterForReminders({})).toBe(false);
  });

  it("is false under Expo Go, which cannot receive remote push", () => {
    (isRunningInExpoGo as jest.Mock).mockReturnValue(true);
    expect(canRegisterForReminders({})).toBe(false);
  });
});

describe("registerForReminders (native)", () => {
  it("reads as unsupported where no token can be minted", async () => {
    Constants.expoConfig!.extra = { eas: { projectId: 42 } };
    await expect(registerForReminders({})).resolves.toEqual({ status: "unsupported" });
    expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it("never reaches expo-notifications under Expo Go, where importing it throws", async () => {
    (isRunningInExpoGo as jest.Mock).mockReturnValue(true);
    await expect(registerForReminders({})).resolves.toEqual({ status: "unsupported" });
    expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it("returns the Expo token without prompting when permission is already granted", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: "granted" });

    await expect(registerForReminders({})).resolves.toEqual({
      status: "registered",
      registration: { channel: "expo", endpoint: "ExponentPushToken[abc]" },
    });
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "proj-1" });
    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it("prompts once when undetermined and reads a refusal as denied", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    mocked.requestPermissionsAsync.mockResolvedValue({ status: "denied" });

    await expect(registerForReminders({})).resolves.toEqual({ status: "denied" });
    expect(mocked.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("creates the Android channel the server addresses before prompting", async () => {
    setPlatform("android");
    mocked.getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    mocked.requestPermissionsAsync.mockResolvedValue({ status: "granted" });

    const result = await registerForReminders({});

    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDER_CHANNEL_ID,
      expect.objectContaining({ importance: 4 })
    );
    expect(result.status).toBe("registered");
  });
});
