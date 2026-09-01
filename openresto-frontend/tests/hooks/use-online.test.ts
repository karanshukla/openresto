/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import { useOnline } from "@/hooks/use-online";

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

type DeviceState = { isConnected?: boolean | null; isInternetReachable?: boolean | null };

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

const setBrowserOnline = (value: boolean) =>
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });

const mockNetworkState = getNetworkStateAsync as jest.MockedFunction<typeof getNetworkStateAsync>;
const mockListener = addNetworkStateListener as jest.MockedFunction<typeof addNetworkStateListener>;

let deviceListeners: ((state: DeviceState) => void)[] = [];
const removeSubscription = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  deviceListeners = [];
  setBrowserOnline(true);
  mockNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as never);
  mockListener.mockImplementation((listener) => {
    deviceListeners.push(listener as (state: DeviceState) => void);
    return { remove: removeSubscription } as ReturnType<typeof addNetworkStateListener>;
  });
});

describe("useOnline on web", () => {
  beforeEach(() => setPlatform("web"));

  it("reports the browser's own connection state", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    expect(getNetworkStateAsync).not.toHaveBeenCalled();
  });

  it("reports offline when the browser says so at mount", () => {
    setBrowserOnline(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it("follows the browser's online/offline events", () => {
    const { result } = renderHook(() => useOnline());

    setBrowserOnline(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    setBrowserOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("stops listening once unmounted", () => {
    const { result, unmount } = renderHook(() => useOnline());
    unmount();

    setBrowserOnline(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(true);
  });
});

describe("useOnline on a device", () => {
  beforeEach(() => setPlatform("ios"));

  it("reads the device's network state at mount", async () => {
    mockNetworkState.mockResolvedValue({
      isConnected: true,
      isInternetReachable: false,
    } as never);

    const { result } = renderHook(() => useOnline());

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("falls back to isConnected where the platform cannot say if the internet is reachable", async () => {
    mockNetworkState.mockResolvedValue({
      isConnected: false,
      isInternetReachable: null,
    } as never);

    const { result } = renderHook(() => useOnline());

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("stays online when the device reports neither", async () => {
    mockNetworkState.mockResolvedValue({} as never);

    const { result } = renderHook(() => useOnline());

    await waitFor(() => expect(getNetworkStateAsync).toHaveBeenCalled());
    expect(result.current).toBe(true);
  });

  it("stays online when the device read fails outright", async () => {
    mockNetworkState.mockRejectedValue(new Error("no module"));

    const { result } = renderHook(() => useOnline());

    await waitFor(() => expect(getNetworkStateAsync).toHaveBeenCalled());
    expect(result.current).toBe(true);
  });

  it("follows later network state changes", async () => {
    const { result } = renderHook(() => useOnline());
    await waitFor(() => expect(deviceListeners).toHaveLength(1));

    act(() => {
      deviceListeners[0]({ isConnected: false, isInternetReachable: false });
    });

    expect(result.current).toBe(false);
  });

  it("removes its listener on unmount, and ignores a read that lands afterwards", async () => {
    let resolveRead: (state: DeviceState) => void = () => {};
    mockNetworkState.mockReturnValue(
      new Promise<DeviceState>((resolve) => {
        resolveRead = resolve;
      }) as never
    );

    const { result, unmount } = renderHook(() => useOnline());
    unmount();

    await act(async () => {
      resolveRead({ isConnected: false, isInternetReachable: false });
    });

    expect(removeSubscription).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });
});
