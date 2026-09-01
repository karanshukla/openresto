/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { useNativeAppStatus } from "@/hooks/use-native-app-status";
import * as nativeAppApi from "@/api/nativeApp";

jest.mock("@/api/nativeApp", () => ({
  fetchNativeAppStatus: jest.fn(),
}));

const fetchStatus = nativeAppApi.fetchNativeAppStatus as jest.Mock;

function Harness() {
  const { status, loading, failed, reload } = useNativeAppStatus();
  return (
    <>
      <Text testID="state">
        {loading ? "loading" : failed ? "failed" : (status?.serverUrl ?? "none")}
      </Text>
      <Pressable testID="reload" onPress={reload}>
        <Text>reload</Text>
      </Pressable>
    </>
  );
}

const state = () => screen.getByTestId("state").props.children;

const statusFor = (serverUrl: string): nativeAppApi.NativeAppStatus => ({
  serverUrl,
  checks: [],
  minimumAppVersion: null,
  clients: [],
});

describe("useNativeAppStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  it("loads the status once on mount", async () => {
    fetchStatus.mockResolvedValue(statusFor("https://a.example.com"));
    render(<Harness />);
    expect(state()).toBe("loading");
    await waitFor(() => expect(state()).toBe("https://a.example.com"));
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  // A refused request is not an instance with nothing configured: the page has to offer a
  // retry rather than a checklist of five things that all look unset.
  it("reports a refused request as failed rather than as an empty status", async () => {
    fetchStatus.mockResolvedValue(null);
    render(<Harness />);
    await waitFor(() => expect(state()).toBe("failed"));
  });

  it("clears a previous failure when the reload succeeds", async () => {
    fetchStatus.mockResolvedValueOnce(null).mockResolvedValue(statusFor("https://b.example.com"));
    render(<Harness />);
    await waitFor(() => expect(state()).toBe("failed"));

    await act(async () => {
      fireEvent.press(screen.getByTestId("reload"));
    });

    expect(state()).toBe("https://b.example.com");
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });

  // The request outlives the screen when an admin navigates away mid-fetch; writing state into
  // an unmounted tree is a warning in this suite and a leak in production.
  it("drops a response that lands after unmount", async () => {
    let resolve: (value: nativeAppApi.NativeAppStatus | null) => void = () => {};
    fetchStatus.mockReturnValue(
      new Promise<nativeAppApi.NativeAppStatus | null>((r) => {
        resolve = r;
      })
    );
    const { unmount } = render(<Harness />);
    unmount();

    await act(async () => {
      resolve(statusFor("https://late.example.com"));
    });

    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });
});
