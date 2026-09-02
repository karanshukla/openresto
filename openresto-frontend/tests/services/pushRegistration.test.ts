/**
 * @jest-environment jsdom
 */
import { canRegisterForReminders, registerForReminders } from "@/services/pushRegistration";

const KEY = "BPUBLICKEY";

function makeSub(endpoint = "https://push.example/sub") {
  return {
    endpoint,
    getKey: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]).buffer),
  };
}

function installPush(existing: ReturnType<typeof makeSub> | null, subscribed = makeSub()) {
  const subscribe = jest.fn().mockResolvedValue(subscribed);
  Object.defineProperty(window, "PushManager", {
    value: function PushManager() {},
    configurable: true,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription: jest.fn().mockResolvedValue(existing), subscribe },
      }),
    },
    configurable: true,
  });
  return { subscribe };
}

function installNotification(permission: string) {
  Object.defineProperty(window, "Notification", {
    value: { requestPermission: jest.fn().mockResolvedValue(permission) },
    configurable: true,
  });
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).PushManager;
  delete (window as unknown as Record<string, unknown>).Notification;
});

describe("canRegisterForReminders (web)", () => {
  it("is false without a server key or without the Push API", () => {
    installPush(null);
    expect(canRegisterForReminders({})).toBe(false);
    expect(canRegisterForReminders({ webPushPublicKey: KEY })).toBe(true);
    delete (window as unknown as Record<string, unknown>).PushManager;
    expect(canRegisterForReminders({ webPushPublicKey: KEY })).toBe(false);
  });
});

describe("registerForReminders (web)", () => {
  it("reads as unsupported without the Push API and never prompts", async () => {
    installNotification("granted");
    await expect(registerForReminders({})).resolves.toEqual({ status: "unsupported" });
  });

  it("reads as denied when the browser prompt is refused", async () => {
    installPush(null);
    installNotification("denied");
    await expect(registerForReminders({ webPushPublicKey: KEY })).resolves.toEqual({
      status: "denied",
    });
  });

  it("subscribes with the server key and returns the endpoint and keys", async () => {
    const { subscribe } = installPush(null);
    installNotification("granted");

    const result = await registerForReminders({ webPushPublicKey: KEY });

    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      })
    );
    expect(result).toEqual({
      status: "registered",
      registration: {
        channel: "webpush",
        endpoint: "https://push.example/sub",
        p256dh: btoa(String.fromCharCode(1, 2, 3)),
        auth: btoa(String.fromCharCode(1, 2, 3)),
      },
    });
  });

  it("reuses an existing browser subscription rather than minting a second", async () => {
    const { subscribe } = installPush(makeSub("https://push.example/existing"));
    installNotification("granted");

    const result = await registerForReminders({ webPushPublicKey: KEY });

    expect(subscribe).not.toHaveBeenCalled();
    expect(result.status === "registered" && result.registration.endpoint).toBe(
      "https://push.example/existing"
    );
  });
});
