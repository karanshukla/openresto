/**
 * @jest-environment jsdom
 */
import { Platform } from "react-native";
import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { deliverApplePass, openGoogleWalletSave, PKPASS_MIME, PKPASS_UTI } from "@/utils/wallet";
import { openExternal } from "@/utils/openExternal";

jest.mock("@/utils/openExternal", () => ({ openExternal: jest.fn() }));

jest.mock("expo-file-system", () => {
  const FileMock = jest.fn(function (this: Record<string, unknown>, _dir: unknown, name: string) {
    this.uri = `file:///cache/${name}`;
  });
  return {
    File: Object.assign(FileMock, {
      downloadFileAsync: jest.fn(async (_url: string, destination: { uri: string }) => destination),
    }),
    Paths: { cache: { uri: "file:///cache/" } },
  };
});

jest.mock("expo-sharing", () => ({ shareAsync: jest.fn().mockResolvedValue(undefined) }));

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

const downloadMock = (File as unknown as { downloadFileAsync: jest.Mock }).downloadFileAsync;

afterEach(() => {
  jest.clearAllMocks();
  setPlatform("web");
});

describe("deliverApplePass", () => {
  it("opens the pass URL on web and downloads nothing", async () => {
    setPlatform("web");
    await deliverApplePass("/api/bookings/ref/r/wallet/apple.pkpass?email=x", "r");
    expect(openExternal).toHaveBeenCalledWith("/api/bookings/ref/r/wallet/apple.pkpass?email=x");
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("downloads to the cache and hands the file to the share sheet as a pkpass off web", async () => {
    setPlatform("ios");
    await deliverApplePass("https://bistro.example/api/x.pkpass", "sunny-taco");
    expect(downloadMock).toHaveBeenCalledWith(
      "https://bistro.example/api/x.pkpass",
      expect.objectContaining({ uri: "file:///cache/reservation-sunny-taco.pkpass" }),
      { idempotent: true }
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///cache/reservation-sunny-taco.pkpass", {
      mimeType: PKPASS_MIME,
      UTI: PKPASS_UTI,
    });
    expect(openExternal).not.toHaveBeenCalled();
  });
});

describe("openGoogleWalletSave", () => {
  it("hands the save link to the platform's own handler", () => {
    openGoogleWalletSave("https://pay.google.com/gp/v/save/jwt");
    expect(openExternal).toHaveBeenCalledWith("https://pay.google.com/gp/v/save/jwt");
  });
});
