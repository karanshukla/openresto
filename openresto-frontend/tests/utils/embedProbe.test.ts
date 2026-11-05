import { frameAncestorsOf, probeEmbed } from "@/utils/embedProbe";

const ALLOWED = ["https://bistro.example", "http://localhost:4321"];
const GOOD_CSP = `default-src 'self'; frame-ancestors ${ALLOWED.join(" ")}; base-uri 'self'`;

const response = (headers: Record<string, string>, status = 200) =>
  ({ ok: status < 400, status, headers: new Headers(headers) }) as Response;

function serve(embed: Response, loader: Response = response({})) {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve(url === "/embed" ? embed : loader)
  ) as never;
}

describe("frameAncestorsOf", () => {
  it("reads the directive's sources", () => {
    expect(frameAncestorsOf(GOOD_CSP)).toEqual(ALLOWED);
  });

  it("finds it in a second policy joined by a comma", () => {
    expect(frameAncestorsOf("default-src 'self', Frame-Ancestors 'none'")).toEqual(["'none'"]);
  });

  it("answers null when no policy names it", () => {
    expect(frameAncestorsOf("default-src 'self'")).toBeNull();
    expect(frameAncestorsOf(null)).toBeNull();
  });
});

describe("probeEmbed", () => {
  it("passes when /embed lists every allowed site and /embed.js may load cross-origin", async () => {
    serve(
      response({ "content-security-policy": GOOD_CSP }),
      response({ "cross-origin-resource-policy": "cross-origin" })
    );
    expect(await probeEmbed(ALLOWED)).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith("/embed", { cache: "no-store" });
  });

  it("needs an allowed site before checking anything", async () => {
    global.fetch = jest.fn() as never;
    expect(await probeEmbed([])).toEqual({ ok: false, problem: "noOrigins" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("flags X-Frame-Options on /embed", async () => {
    serve(response({ "content-security-policy": GOOD_CSP, "x-frame-options": "DENY" }));
    expect(await probeEmbed(ALLOWED)).toEqual({ ok: false, problem: "frameOptions" });
  });

  it.each([
    ["the shared policy", "default-src 'self'; frame-ancestors 'none'"],
    ["only one of the sites", "frame-ancestors https://bistro.example"],
    ["no policy at all", ""],
  ])("flags frame-ancestors carrying %s", async (_label, csp) => {
    serve(response(csp ? { "content-security-policy": csp } : {}));
    expect(await probeEmbed(ALLOWED)).toEqual({ ok: false, problem: "frameAncestors" });
  });

  it.each(["same-origin", "Same-Site"])("flags a %s loader", async (corp) => {
    serve(
      response({ "content-security-policy": GOOD_CSP }),
      response({ "cross-origin-resource-policy": corp })
    );
    expect(await probeEmbed(ALLOWED)).toEqual({ ok: false, problem: "loaderBlocked" });
  });

  it("flags a missing page or loader, or a failed request", async () => {
    serve(response({}, 404));
    expect(await probeEmbed(ALLOWED)).toEqual({ ok: false, problem: "unreachable" });

    serve(response({ "content-security-policy": GOOD_CSP }), response({}, 404));
    expect(await probeEmbed(ALLOWED)).toEqual({ ok: false, problem: "unreachable" });

    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as never;
    expect(await probeEmbed(ALLOWED)).toEqual({ ok: false, problem: "unreachable" });
  });
});
