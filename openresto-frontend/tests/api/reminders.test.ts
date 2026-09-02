import { subscribeReminder, unsubscribeReminder } from "@/api/reminders";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("subscribeReminder", () => {
  it("posts the registration with the email and locale and reports ok", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const ok = await subscribeReminder(
      "sunny taco/1234",
      "guest@example.com",
      { channel: "webpush", endpoint: "https://push.example/abc", p256dh: "p", auth: "a" },
      "fr"
    );

    expect(ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/bookings/ref/sunny%20taco%2F1234/reminders");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "guest@example.com",
      locale: "fr",
      channel: "webpush",
      endpoint: "https://push.example/abc",
      p256dh: "p",
      auth: "a",
    });
  });

  it("reports false on a non-2xx rather than throwing", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(
      subscribeReminder("ref", "x@y.z", { channel: "expo", endpoint: "ExponentPushToken[1]" }, "en")
    ).resolves.toBe(false);
  });

  it("reports false when the request itself fails", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error("offline"));
    await expect(
      subscribeReminder("ref", "x@y.z", { channel: "expo", endpoint: "ExponentPushToken[1]" }, "en")
    ).resolves.toBe(false);
    spy.mockRestore();
  });
});

describe("unsubscribeReminder", () => {
  it("sends the endpoint and email in a DELETE body", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await expect(unsubscribeReminder("ref-1", "x@y.z", "ExponentPushToken[1]")).resolves.toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/bookings/ref/ref-1/reminders");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ email: "x@y.z", endpoint: "ExponentPushToken[1]" });
  });

  it("reports false on a non-2xx and on a network failure", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(unsubscribeReminder("ref-1", "x@y.z", "e")).resolves.toBe(false);
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(unsubscribeReminder("ref-1", "x@y.z", "e")).resolves.toBe(false);
    spy.mockRestore();
  });
});
