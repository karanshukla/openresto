import {
  DEFAULT_API_PORT,
  HOST_ENV,
  checkBackend,
  parseArgs,
  pickLanAddress,
  resolveApiUrl,
  resolvePort,
} from "../../scripts/lib/expo-go.mjs";

const wifi = { family: "IPv4", internal: false, address: "192.168.50.239" };
const loopback = { family: "IPv4", internal: true, address: "127.0.0.1" };
const hyperV = { family: "IPv4", internal: false, address: "172.29.64.1" };
const ipv6 = { family: "IPv6", internal: false, address: "fe80::1" };

describe("pickLanAddress", () => {
  it("takes the address the routing table actually uses", () => {
    const interfaces = { "vEthernet (WSL)": [hyperV], "Wi-Fi": [wifi] };
    expect(pickLanAddress(interfaces, "192.168.50.239")).toBe("192.168.50.239");
  });

  it("skips a virtual adapter when the probe found nothing", () => {
    const interfaces = { "vEthernet (WSL)": [hyperV], "Wi-Fi": [wifi] };
    expect(pickLanAddress(interfaces, undefined)).toBe("192.168.50.239");
  });

  it("ignores a probe result no interface reports", () => {
    expect(pickLanAddress({ "Wi-Fi": [wifi] }, "10.9.9.9")).toBe("192.168.50.239");
  });

  it("falls back to a virtual adapter only when it is all there is", () => {
    expect(pickLanAddress({ "vEthernet (WSL)": [hyperV] }, undefined)).toBe("172.29.64.1");
  });

  it("never offers a loopback or IPv6 address", () => {
    expect(pickLanAddress({ Loopback: [loopback], "Wi-Fi": [ipv6] }, undefined)).toBeUndefined();
    expect(pickLanAddress({}, undefined)).toBeUndefined();
    expect(pickLanAddress(undefined, undefined)).toBeUndefined();
  });
});

describe("parseArgs", () => {
  it("reads host and port in both spellings and passes the rest to expo", () => {
    expect(parseArgs(["--host", "10.0.0.5", "--port=5062", "--", "--clear"])).toEqual({
      host: "10.0.0.5",
      port: "5062",
      expoArgs: ["--clear"],
    });
  });

  it("rejects an unknown option and a value-less one", () => {
    expect(() => parseArgs(["--tunnel"])).toThrow('Unknown option "--tunnel"');
    expect(() => parseArgs(["--host", "--port", "5062"])).toThrow('"host" needs a value');
    expect(() => parseArgs(["--host"])).toThrow('"host" needs a value');
  });

  it("takes --help without a value", () => {
    expect(parseArgs(["--help"])).toEqual({ help: true, expoArgs: [] });
  });
});

describe("resolvePort", () => {
  it("defaults to the backend's port and accepts the ends of the range", () => {
    expect(resolvePort(undefined)).toBe(DEFAULT_API_PORT);
    expect(resolvePort("1")).toBe(1);
    expect(resolvePort("65535")).toBe(65535);
  });

  it("rejects a value outside the range or not a whole number", () => {
    expect(() => resolvePort("0")).toThrow("not a port number");
    expect(() => resolvePort("65536")).toThrow("not a port number");
    expect(() => resolvePort("8080.5")).toThrow("not a port number");
    expect(() => resolvePort("eighty")).toThrow("not a port number");
  });
});

describe("resolveApiUrl", () => {
  it("prefers the flag, then the environment, then the detected address", () => {
    const detected = { options: {}, env: {}, lanAddress: "192.168.50.239" };
    expect(resolveApiUrl(detected)).toBe("http://192.168.50.239:8080");
    expect(resolveApiUrl({ ...detected, env: { [HOST_ENV]: "10.0.2.2" } })).toBe(
      "http://10.0.2.2:8080"
    );
    expect(
      resolveApiUrl({ ...detected, options: { host: "10.0.0.5" }, env: { [HOST_ENV]: "10.0.2.2" } })
    ).toBe("http://10.0.0.5:8080");
  });

  it("applies the port to whichever host won", () => {
    expect(resolveApiUrl({ options: { port: "5062" }, env: {}, lanAddress: "10.0.0.5" })).toBe(
      "http://10.0.0.5:5062"
    );
  });

  it("says how to supply a host when none could be worked out", () => {
    expect(() => resolveApiUrl({ options: {}, env: {}, lanAddress: undefined })).toThrow(
      "--host <ip>"
    );
  });
});

describe("checkBackend", () => {
  it("passes when the instance answers", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    await expect(checkBackend("http://10.0.0.5:8080", fetchImpl)).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://10.0.0.5:8080/api/brand",
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it("reports the status when the instance answers something else", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 502 });
    await expect(checkBackend("http://10.0.0.5:8080", fetchImpl)).resolves.toEqual({
      ok: false,
      reason: "http://10.0.0.5:8080/api/brand answered 502.",
    });
  });

  it("reports an unreachable address rather than throwing", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("timed out"));
    await expect(checkBackend("http://10.0.0.5:8080", fetchImpl)).resolves.toEqual({
      ok: false,
      reason: "http://10.0.0.5:8080/api/brand is not reachable: timed out",
    });
  });
});
