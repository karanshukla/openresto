import { renderHook, act } from "@testing-library/react-native";
import { Platform } from "react-native";
import { usePersistedState } from "@/hooks/use-persisted-state";

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

Object.defineProperty(global, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
  // Default to web platform
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
});

describe("usePersistedState (web)", () => {
  it("returns defaultValue when localStorage has no entry", () => {
    const { result } = renderHook(() => usePersistedState("test-key", 42));
    expect(result.current[0]).toBe(42);
  });

  it("returns stored value when localStorage has a valid entry", () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(99));
    const { result } = renderHook(() => usePersistedState("test-key", 0));
    expect(result.current[0]).toBe(99);
  });

  it("persists value to localStorage on state change", () => {
    const { result } = renderHook(() => usePersistedState("my-key", "initial"));

    act(() => {
      result.current[1]("updated");
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith("my-key", JSON.stringify("updated"));
    expect(result.current[0]).toBe("updated");
  });

  it("returns defaultValue when localStorage.getItem throws", () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error("storage error");
    });
    const { result } = renderHook(() => usePersistedState("bad-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("returns defaultValue when stored JSON is invalid", () => {
    localStorageMock.getItem.mockReturnValueOnce("not-valid-json{{{");
    const { result } = renderHook(() => usePersistedState("bad-json-key", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });

  it("handles object default values", () => {
    const defaultObj = { count: 0, label: "test" };
    const { result } = renderHook(() => usePersistedState("obj-key", defaultObj));
    expect(result.current[0]).toEqual(defaultObj);
  });

  it("silently ignores localStorage.setItem errors", () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error("quota exceeded");
    });
    const { result } = renderHook(() => usePersistedState("err-key", 0));
    // Should not throw
    act(() => {
      result.current[1](1);
    });
    expect(result.current[0]).toBe(1);
  });
});

describe("usePersistedState (native)", () => {
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  });

  it("returns defaultValue without accessing localStorage", () => {
    const { result } = renderHook(() => usePersistedState("native-key", "native-default"));
    expect(result.current[0]).toBe("native-default");
    expect(localStorageMock.getItem).not.toHaveBeenCalled();
  });

  it("does not persist to localStorage when state changes", () => {
    const { result } = renderHook(() => usePersistedState("native-key", 0));

    act(() => {
      result.current[1](5);
    });

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(result.current[0]).toBe(5);
  });
});
