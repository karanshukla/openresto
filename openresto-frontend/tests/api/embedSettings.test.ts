import { getEmbedOrigins, saveEmbedOrigins } from "@/api/embedSettings";
import { get, put } from "@/api/client";

jest.mock("@/api/client", () => ({ get: jest.fn(), put: jest.fn() }));

const response = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe("embed settings API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads the allowed origins", async () => {
    (get as jest.Mock).mockResolvedValue(response(200, { allowedOrigins: ["https://a.example"] }));
    expect(await getEmbedOrigins()).toEqual(["https://a.example"]);
    expect(get).toHaveBeenCalledWith("/admin/embed-settings");
  });

  it("answers null when the read is refused or fails", async () => {
    (get as jest.Mock).mockResolvedValueOnce(response(403, {}));
    expect(await getEmbedOrigins()).toBeNull();
    (get as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    expect(await getEmbedOrigins()).toBeNull();
  });

  it("saves the whole list and returns what the server stored", async () => {
    (put as jest.Mock).mockResolvedValue(response(200, { allowedOrigins: ["https://a.example"] }));
    expect(await saveEmbedOrigins(["https://A.example/"])).toEqual({
      ok: true,
      origins: ["https://a.example"],
    });
    expect(put).toHaveBeenCalledWith("/admin/embed-settings", {
      allowedOrigins: ["https://A.example/"],
    });
  });

  it("returns the server's message for a refused origin", async () => {
    (put as jest.Mock).mockResolvedValue(response(400, { message: "Not a site address." }));
    expect(await saveEmbedOrigins(["nope"])).toEqual({ ok: false, message: "Not a site address." });
  });

  it("reports a network failure", async () => {
    (put as jest.Mock).mockRejectedValue(new Error("offline"));
    expect(await saveEmbedOrigins([])).toEqual({ ok: false, message: "Network error." });
  });
});
