/**
 * Covers `services/storage.native.ts` — the implementation Metro resolves on ios/android.
 * The rest of the suite runs against the web file (Jest maps `@/services/storage` to it,
 * since every other test asserts localStorage), so this file names the native module.
 */
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItemSync: jest.fn(() => null),
    setItemSync: jest.fn(),
    removeItemSync: jest.fn(),
  },
}));

import Storage from "expo-sqlite/kv-store";
import { StorageService } from "@/services/storage.native";

const kv = Storage as unknown as {
  getItemSync: jest.Mock;
  setItemSync: jest.Mock;
  removeItemSync: jest.Mock;
};

beforeEach(() => {
  kv.getItemSync.mockReset().mockReturnValue(null);
  kv.setItemSync.mockReset();
  kv.removeItemSync.mockReset();
});

describe("StorageService (native — expo-sqlite kv-store)", () => {
  it("getItem reads through to the kv-store's synchronous getter", () => {
    kv.getItemSync.mockReturnValue("v");
    expect(StorageService.getItem("k")).toBe("v");
    expect(kv.getItemSync).toHaveBeenCalledWith("k");
  });

  it("getItem returns null when the key is absent", () => {
    expect(StorageService.getItem("missing")).toBeNull();
  });

  it("setItem writes through to the kv-store", () => {
    StorageService.setItem("k", "v");
    expect(kv.setItemSync).toHaveBeenCalledWith("k", "v");
  });

  it("removeItem deletes through to the kv-store", () => {
    StorageService.removeItem("k");
    expect(kv.removeItemSync).toHaveBeenCalledWith("k");
  });

  it("getItem returns null (not throws) when the store throws", () => {
    kv.getItemSync.mockImplementation(() => {
      throw new Error("database is locked");
    });
    expect(StorageService.getItem("k")).toBeNull();
  });

  it("setItem swallows errors silently", () => {
    kv.setItemSync.mockImplementation(() => {
      throw new Error("disk full");
    });
    expect(() => StorageService.setItem("k", "v")).not.toThrow();
  });

  it("removeItem swallows errors silently", () => {
    kv.removeItemSync.mockImplementation(() => {
      throw new Error("database is locked");
    });
    expect(() => StorageService.removeItem("k")).not.toThrow();
  });
});
