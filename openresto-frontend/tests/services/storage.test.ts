import { Platform } from "react-native";
import { StorageService } from "@/services/storage";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock, configurable: true });

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
});

describe("StorageService (web)", () => {
  it("getItem returns null when the key is absent", () => {
    expect(StorageService.getItem("missing")).toBeNull();
  });

  it("setItem stores a value that getItem returns", () => {
    StorageService.setItem("k", "v");
    expect(StorageService.getItem("k")).toBe("v");
  });

  it("removeItem deletes a stored value", () => {
    StorageService.setItem("k", "v");
    StorageService.removeItem("k");
    expect(StorageService.getItem("k")).toBeNull();
  });

  it("getItem returns null (not throws) when localStorage.getItem throws", () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error("denied");
    });
    expect(StorageService.getItem("k")).toBeNull();
  });

  it("setItem swallows errors silently", () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error("quota exceeded");
    });
    expect(() => StorageService.setItem("k", "v")).not.toThrow();
  });

  it("removeItem swallows errors silently", () => {
    localStorageMock.removeItem.mockImplementationOnce(() => {
      throw new Error("denied");
    });
    expect(() => StorageService.removeItem("k")).not.toThrow();
  });
});

describe("StorageService (native — no-op)", () => {
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  });

  it("getItem returns null without touching localStorage", () => {
    expect(StorageService.getItem("k")).toBeNull();
    expect(localStorageMock.getItem).not.toHaveBeenCalled();
  });

  it("setItem is a no-op (no localStorage call)", () => {
    StorageService.setItem("k", "v");
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("removeItem is a no-op (no localStorage call)", () => {
    StorageService.removeItem("k");
    expect(localStorageMock.removeItem).not.toHaveBeenCalled();
  });
});
