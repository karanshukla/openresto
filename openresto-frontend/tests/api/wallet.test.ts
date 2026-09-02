import { appleWalletPassUrl, fetchGoogleWalletSaveUrl } from "@/api/wallet";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("appleWalletPassUrl", () => {
  it("builds the pkpass URL with the reference and email encoded", () => {
    expect(appleWalletPassUrl("sunny taco", "a+b@example.com")).toBe(
      "/api/bookings/ref/sunny%20taco/wallet/apple.pkpass?email=a%2Bb%40example.com"
    );
  });
});

describe("fetchGoogleWalletSaveUrl", () => {
  it("returns the save URL the server hands back", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ saveUrl: "https://pay.google.com/gp/v/save/abc" }),
    });

    await expect(fetchGoogleWalletSaveUrl("ref-1", "x@y.z")).resolves.toBe(
      "https://pay.google.com/gp/v/save/abc"
    );
    expect(mockFetch.mock.calls[0][0]).toBe("/api/bookings/ref/ref-1/wallet/google?email=x%40y.z");
  });

  it("returns null on a non-2xx, an empty body, and a network failure", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchGoogleWalletSaveUrl("ref-1", "x@y.z")).resolves.toBeNull();

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(fetchGoogleWalletSaveUrl("ref-1", "x@y.z")).resolves.toBeNull();

    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchGoogleWalletSaveUrl("ref-1", "x@y.z")).resolves.toBeNull();
    spy.mockRestore();
  });
});
