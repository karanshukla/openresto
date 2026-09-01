import { fetchNativeAppStatus } from "@/api/nativeApp";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => mockFetch.mockReset());

describe("fetchNativeAppStatus", () => {
  it("returns the status document from the admin endpoint", async () => {
    const status = {
      serverUrl: "https://b.example",
      checks: [],
      minimumAppVersion: null,
      clients: [],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => status });
    await expect(fetchNativeAppStatus()).resolves.toEqual(status);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/native-app/status");
  });

  it("returns null on a refused request and on a network failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(fetchNativeAppStatus()).resolves.toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchNativeAppStatus()).resolves.toBeNull();
  });
});
