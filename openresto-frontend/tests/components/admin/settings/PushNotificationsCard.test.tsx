import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Platform } from "react-native";
import { PushNotificationsCard } from "@/components/admin/settings/PushNotificationsCard";
import * as notificationsApi from "@/api/notifications";
import * as restaurantsApi from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

jest.mock("@/api/notifications", () => ({
  getVapidPublicKey: jest.fn(),
  subscribePush: jest.fn(),
  unsubscribePush: jest.fn(),
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(),
}));

// Typed shortcuts
const mockGetVapidPublicKey = notificationsApi.getVapidPublicKey as jest.Mock;
const mockSubscribePush = notificationsApi.subscribePush as jest.Mock;
const mockUnsubscribePush = notificationsApi.unsubscribePush as jest.Mock;
const mockFetchRestaurants = restaurantsApi.fetchRestaurants as jest.Mock;

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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});

  // Default: web with push support available, inactive subscription
  setupWebEnvironment();
  mockGetVapidPublicKey.mockResolvedValue("test-vapid-key");
  mockFetchRestaurants.mockResolvedValue([{ id: 1, name: "Location A" }]);
  mockSubscribePush.mockResolvedValue(undefined);
  mockUnsubscribePush.mockResolvedValue(undefined);

  // Default Notification: default permission
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

describe("PushNotificationsCard", () => {
  describe("non-web platform", () => {
    it("renders null on native platform", async () => {
      Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
      mockGetVapidPublicKey.mockResolvedValue("key");

      const { toJSON } = render(<PushNotificationsCard />);

      // Initially renders null (vapidKey === undefined)
      expect(toJSON()).toBeNull();

      // After effects fire, still returns null for native unavailable
      await act(async () => {
        await Promise.resolve();
      });

      expect(toJSON()).toBeNull();
    });
  });

  describe("web platform - unconfigured (no VAPID key)", () => {
    it("shows Push Notifications heading after loading", async () => {
      mockGetVapidPublicKey.mockResolvedValue(null);

      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText("Push Notifications")).toBeTruthy();
      });
    });

    it("shows VAPID keys not configured status text", async () => {
      mockGetVapidPublicKey.mockResolvedValue(null);

      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText("VAPID keys not configured")).toBeTruthy();
      });
    });

    it("shows unconfigured message in expanded body", async () => {
      mockGetVapidPublicKey.mockResolvedValue(null);

      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText(/Push notifications require VAPID keys/)).toBeTruthy();
      });
    });
  });

  describe("web platform - unavailable (no PushManager)", () => {
    it("shows unavailable status when PushManager missing", async () => {
      setupWebEnvironment(true, false);
      mockGetVapidPublicKey.mockResolvedValue("key");

      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText("Not supported in this browser")).toBeTruthy();
      });
    });
  });

  describe("web platform - denied", () => {
    it("shows denied status when Notification permission is denied", async () => {
      Object.defineProperty(global, "Notification", {
        value: { permission: "denied", requestPermission: jest.fn() },
        configurable: true,
        writable: true,
      });

      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText("Notifications blocked — enable in browser settings")).toBeTruthy();
      });
    });
  });

  describe("web platform - inactive (no existing subscription)", () => {
    it("shows inactive status text when no existing subscription", async () => {
      const sw = makeSW(null);
      setNavigatorSW(sw);

      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText("Enable to receive real-time booking alerts")).toBeTruthy();
      });
    });

    it("shows Enable push notifications button", async () => {
      const sw = makeSW(null);
      setNavigatorSW(sw);

      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText("Enable push notifications")).toBeTruthy();
      });
    });
  });

  describe("web platform - active (existing subscription)", () => {
    it("shows active status text when subscription exists", async () => {
      const sw = makeSW(makeSub());
      setNavigatorSW(sw);

      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText("Push notifications active for all locations")).toBeTruthy();
      });
    });

    it("shows Disable push notifications button when active", async () => {
      const sw = makeSW(makeSub());
      setNavigatorSW(sw);

      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText("Disable push notifications")).toBeTruthy();
      });
    });
  });

  describe("handleEnable", () => {
    async function renderInactive() {
      const sw = makeSW(null);
      setNavigatorSW(sw);
      render(<PushNotificationsCard />);
      await waitFor(() => {
        expect(screen.getByText("Enable push notifications")).toBeTruthy();
      });
      return sw;
    }

    it("enables push and transitions to active on success", async () => {
      const sw = await renderInactive();
      (sw.pushManager.subscribe as jest.Mock).mockResolvedValue(makeSub());

      await act(async () => {
        fireEvent.press(screen.getByText("Enable push notifications"));
      });

      await waitFor(() => {
        expect(mockSubscribePush).toHaveBeenCalled();
        expect(screen.getByText("Push notifications active for all locations")).toBeTruthy();
      });
    });

    it("shows denied state when requestPermission returns denied", async () => {
      await renderInactive();
      (global.Notification.requestPermission as jest.Mock).mockResolvedValue("denied");

      await act(async () => {
        fireEvent.press(screen.getByText("Enable push notifications"));
      });

      await waitFor(() => {
        expect(screen.getByText("Notifications blocked — enable in browser settings")).toBeTruthy();
      });
    });

    it("does nothing when permission is dismissed (not granted, not denied)", async () => {
      await renderInactive();
      (global.Notification.requestPermission as jest.Mock).mockResolvedValue("default");

      await act(async () => {
        fireEvent.press(screen.getByText("Enable push notifications"));
      });

      // Should stay inactive
      await waitFor(() => {
        expect(screen.getByText("Enable push notifications")).toBeTruthy();
      });
    });

    it("shows error message when subscribe throws", async () => {
      const sw = await renderInactive();
      (sw.pushManager.subscribe as jest.Mock).mockRejectedValue(new Error("subscribe failed"));

      await act(async () => {
        fireEvent.press(screen.getByText("Enable push notifications"));
      });

      await waitFor(() => {
        expect(screen.getByText("Failed to enable push notifications.")).toBeTruthy();
      });
    });
  });

  describe("handleDisable", () => {
    async function renderActive() {
      const existingSub = makeSub();
      const sw = makeSW(existingSub);
      setNavigatorSW(sw);
      render(<PushNotificationsCard />);
      await waitFor(() => {
        expect(screen.getByText("Disable push notifications")).toBeTruthy();
      });
      return { sw, existingSub };
    }

    it("disables push and transitions to inactive on success", async () => {
      const { existingSub } = await renderActive();

      await act(async () => {
        fireEvent.press(screen.getByText("Disable push notifications"));
      });

      await waitFor(() => {
        expect(existingSub.unsubscribe).toHaveBeenCalled();
        expect(mockUnsubscribePush).toHaveBeenCalledWith(existingSub.endpoint);
        expect(screen.getByText("Enable push notifications")).toBeTruthy();
      });
    });

    it("shows error message when unsubscribe throws", async () => {
      const { existingSub } = await renderActive();
      existingSub.unsubscribe.mockRejectedValue(new Error("unsubscribe failed"));

      await act(async () => {
        fireEvent.press(screen.getByText("Disable push notifications"));
      });

      await waitFor(() => {
        expect(screen.getByText("Failed to disable push notifications.")).toBeTruthy();
      });
    });
  });

  describe("expand/collapse", () => {
    it("toggles collapse when header is pressed", async () => {
      mockGetVapidPublicKey.mockResolvedValue(null);
      render(<PushNotificationsCard />);

      await waitFor(() => {
        expect(screen.getByText("Push Notifications")).toBeTruthy();
      });

      // Press header to collapse
      fireEvent.press(screen.getByText("Push Notifications"));
      // Press again to expand
      fireEvent.press(screen.getByText("Push Notifications"));

      expect(screen.getByText("Push Notifications")).toBeTruthy();
    });
  });
});
