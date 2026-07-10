import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Platform } from "react-native";
import { PushBanner } from "@/components/admin/notifications/PushBanner";
import * as notificationsApi from "@/api/notifications";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/notifications", () => ({
  getVapidPublicKey: jest.fn(),
  subscribePush: jest.fn(),
}));

const mockGetVapidPublicKey = notificationsApi.getVapidPublicKey as jest.Mock;
const mockSubscribePush = notificationsApi.subscribePush as jest.Mock;

// Use global as Record to avoid bare `navigator`/`window` which may not exist in the node test env
const g = global as Record<string, unknown>;

// Build a fake push subscription
function makeSub(endpoint = "https://push.example.com/sub") {
  const buffer = new ArrayBuffer(16);
  return {
    endpoint,
    getKey: jest.fn().mockReturnValue(buffer),
    unsubscribe: jest.fn().mockResolvedValue(true),
  };
}

// Build a fake service worker with pushManager
function makeSW(existingSub: ReturnType<typeof makeSub> | null = null) {
  return {
    pushManager: {
      getSubscription: jest.fn().mockResolvedValue(existingSub),
      subscribe: jest.fn().mockResolvedValue(makeSub()),
    },
  };
}

function setNavigatorSW(sw: ReturnType<typeof makeSW> | null) {
  if (!g.navigator || typeof g.navigator !== "object") {
    Object.defineProperty(global, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });
  }
  const nav = g.navigator as Record<string, unknown>;
  if (sw) {
    nav.serviceWorker = { ready: Promise.resolve(sw) };
  } else {
    delete nav.serviceWorker;
  }
}

function setupWebEnvironment(hasServiceWorker = true, hasPushManager = true) {
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });

  setNavigatorSW(hasServiceWorker ? makeSW() : null);

  if (hasPushManager) {
    g.PushManager = {};
  } else {
    delete g.PushManager;
  }
}

const defaultProps = {
  restaurantId: 1,
  primaryColor: "#0a7ea4",
  isDark: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});

  setupWebEnvironment();
  mockGetVapidPublicKey.mockResolvedValue("test-vapid-key");
  mockSubscribePush.mockResolvedValue(undefined);

  Object.defineProperty(global, "Notification", {
    value: {
      permission: "default",
      requestPermission: jest.fn().mockResolvedValue("granted"),
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
});

describe("PushBanner", () => {
  describe("non-web platform", () => {
    it("renders null on native platform", async () => {
      Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });

      const { toJSON } = render(<PushBanner {...defaultProps} />);

      expect(toJSON()).toBeNull();

      await act(async () => {
        await Promise.resolve();
      });

      expect(toJSON()).toBeNull();
      expect(mockGetVapidPublicKey).not.toHaveBeenCalled();
    });
  });

  describe("web - no VAPID key configured", () => {
    it("renders null while vapidKey is undefined and stays null when null", async () => {
      mockGetVapidPublicKey.mockResolvedValue(null);

      const { toJSON } = render(<PushBanner {...defaultProps} />);
      expect(toJSON()).toBeNull();

      await waitFor(() => {
        expect(mockGetVapidPublicKey).toHaveBeenCalled();
      });

      // vapidKey resolves to null -> status "unsupported" -> still renders null
      await act(async () => {
        await Promise.resolve();
      });
      expect(toJSON()).toBeNull();
    });
  });

  describe("web - unsupported (missing serviceWorker/PushManager)", () => {
    it("renders null when serviceWorker is missing", async () => {
      setupWebEnvironment(false, true);

      const { toJSON } = render(<PushBanner {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetVapidPublicKey).toHaveBeenCalled();
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(toJSON()).toBeNull();
    });

    it("renders null when PushManager is missing", async () => {
      setupWebEnvironment(true, false);

      const { toJSON } = render(<PushBanner {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetVapidPublicKey).toHaveBeenCalled();
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(toJSON()).toBeNull();
    });
  });

  describe("web - denied", () => {
    it("shows the blocked banner text when Notification permission is denied", async () => {
      Object.defineProperty(global, "Notification", {
        value: { permission: "denied", requestPermission: jest.fn() },
        configurable: true,
        writable: true,
      });

      render(<PushBanner {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Push notifications blocked - enable in browser site settings.")
        ).toBeTruthy();
      });
    });

    it("shows the blocked banner in dark mode too", async () => {
      Object.defineProperty(global, "Notification", {
        value: { permission: "denied", requestPermission: jest.fn() },
        configurable: true,
        writable: true,
      });

      render(<PushBanner {...defaultProps} isDark={true} />);

      await waitFor(() => {
        expect(
          screen.getByText("Push notifications blocked - enable in browser site settings.")
        ).toBeTruthy();
      });
    });
  });

  describe("web - active (existing subscription)", () => {
    it("renders null when a push subscription already exists", async () => {
      const sw = makeSW(makeSub());
      setNavigatorSW(sw);

      const { toJSON } = render(<PushBanner {...defaultProps} />);

      await waitFor(() => {
        expect(sw.pushManager.getSubscription).toHaveBeenCalled();
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(toJSON()).toBeNull();
    });
  });

  describe("web - inactive (no existing subscription)", () => {
    async function renderInactive() {
      const sw = makeSW(null);
      setNavigatorSW(sw);
      render(<PushBanner {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Enable")).toBeTruthy();
      });
      return sw;
    }

    it("shows the enable banner with prompt text and button", async () => {
      await renderInactive();

      expect(
        screen.getByText("Enable push notifications to get real-time booking alerts.")
      ).toBeTruthy();
      expect(screen.getByText("Enable")).toBeTruthy();
    });

    it("shows the enable banner in dark mode too", async () => {
      const sw = makeSW(null);
      setNavigatorSW(sw);
      render(<PushBanner {...defaultProps} isDark={true} />);

      await waitFor(() => {
        expect(screen.getByText("Enable")).toBeTruthy();
      });
      expect(
        screen.getByText("Enable push notifications to get real-time booking alerts.")
      ).toBeTruthy();
    });

    it("subscribes and shows nothing (renders null) once active", async () => {
      const sw = await renderInactive();
      const sub = makeSub();
      (sw.pushManager.subscribe as jest.Mock).mockResolvedValue(sub);

      await act(async () => {
        fireEvent.press(screen.getByText("Enable"));
      });

      await waitFor(() => {
        expect(mockSubscribePush).toHaveBeenCalledWith(
          defaultProps.restaurantId,
          expect.objectContaining({ endpoint: sub.endpoint })
        );
      });

      await waitFor(() => {
        expect(screen.queryByText("Enable")).toBeNull();
      });
    });

    it("falls back to restaurantId 0 when restaurantId is null", async () => {
      const sw = makeSW(null);
      setNavigatorSW(sw);
      render(<PushBanner {...defaultProps} restaurantId={null} />);
      await waitFor(() => {
        expect(screen.getByText("Enable")).toBeTruthy();
      });

      const sub = makeSub();
      (sw.pushManager.subscribe as jest.Mock).mockResolvedValue(sub);

      await act(async () => {
        fireEvent.press(screen.getByText("Enable"));
      });

      await waitFor(() => {
        expect(mockSubscribePush).toHaveBeenCalledWith(0, expect.any(Object));
      });
    });

    it("transitions to denied and shows an error when requestPermission returns denied", async () => {
      await renderInactive();
      (global.Notification.requestPermission as jest.Mock).mockResolvedValue("denied");

      await act(async () => {
        fireEvent.press(screen.getByText("Enable"));
      });

      // Status flips to "denied", which re-renders the denied banner (replacing the
      // inactive banner that would have shown the ephemeral errorMsg).
      await waitFor(() => {
        expect(
          screen.getByText("Push notifications blocked - enable in browser site settings.")
        ).toBeTruthy();
      });
    });

    it("does nothing further when permission is dismissed (not granted, not denied)", async () => {
      await renderInactive();
      (global.Notification.requestPermission as jest.Mock).mockResolvedValue("default");

      await act(async () => {
        fireEvent.press(screen.getByText("Enable"));
      });

      await waitFor(() => {
        expect(screen.getByText("Enable")).toBeTruthy();
      });
      expect(mockSubscribePush).not.toHaveBeenCalled();
    });

    it("shows an error message when subscribe throws", async () => {
      const sw = await renderInactive();
      (sw.pushManager.subscribe as jest.Mock).mockRejectedValue(new Error("subscribe failed"));

      await act(async () => {
        fireEvent.press(screen.getByText("Enable"));
      });

      await waitFor(() => {
        expect(screen.getByText("Failed to enable - try again.")).toBeTruthy();
      });
      expect(console.error).toHaveBeenCalledWith("Push subscribe error:", expect.any(Error));
    });

    it("shows an error message when the subscription is missing p256dh/auth keys", async () => {
      const sw = await renderInactive();
      const badSub = { endpoint: "https://push.example.com/bad", getKey: jest.fn(() => null) };
      (sw.pushManager.subscribe as jest.Mock).mockResolvedValue(badSub);

      await act(async () => {
        fireEvent.press(screen.getByText("Enable"));
      });

      await waitFor(() => {
        expect(screen.getByText("Failed to enable - try again.")).toBeTruthy();
      });
      expect(mockSubscribePush).not.toHaveBeenCalled();
    });

    it("guards against pressing Enable with a falsy vapidKey (no-op)", async () => {
      mockGetVapidPublicKey.mockResolvedValue("");
      const sw = makeSW(null);
      setNavigatorSW(sw);

      render(<PushBanner {...defaultProps} />);

      // vapidKey resolves to "" (falsy, but not null/undefined), so usePushStatus proceeds
      // past its `vapidKey === null` short-circuit and resolves the real subscription status
      // via the service worker, landing on "inactive" and rendering the Enable banner.
      await waitFor(() => {
        expect(screen.getByText("Enable")).toBeTruthy();
      });

      // handleEnable's `if (!vapidKey) return;` guard means pressing does nothing.
      await act(async () => {
        fireEvent.press(screen.getByText("Enable"));
      });
      expect(mockSubscribePush).not.toHaveBeenCalled();
    });
  });
});
