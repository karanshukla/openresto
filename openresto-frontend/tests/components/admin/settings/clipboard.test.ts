import { Platform } from "react-native";
import { copyToClipboard } from "@/components/admin/settings/clipboard";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

describe("copyToClipboard", () => {
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    setClipboard(undefined);
  });

  it("reports success only once the write resolves", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await expect(copyToClipboard("orst_1_secret")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("orst_1_secret");
  });

  it("reports failure when the browser exposes no clipboard", async () => {
    setClipboard(undefined);

    await expect(copyToClipboard("orst_1_secret")).resolves.toBe(false);
  });

  it("reports failure when the write is rejected", async () => {
    setClipboard({ writeText: jest.fn().mockRejectedValue(new Error("NotAllowedError")) });

    await expect(copyToClipboard("orst_1_secret")).resolves.toBe(false);
  });

  it("reports failure rather than confirming an empty copy", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await expect(copyToClipboard("")).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("reports failure off web, where there is no clipboard API to reach", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    setClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });

    await expect(copyToClipboard("orst_1_secret")).resolves.toBe(false);
  });
});
