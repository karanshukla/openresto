/** Why the widget would not load on an allowed site, as seen through this deployment's proxy. */
export type EmbedProbeProblem =
  "noOrigins" | "unreachable" | "frameOptions" | "frameAncestors" | "loaderBlocked";

export type EmbedProbeResult = { ok: true } | { ok: false; problem: EmbedProbeProblem };

/**
 * The sources of the `frame-ancestors` directive in a Content-Security-Policy value, or null
 * when no policy names one. Several CSP headers arrive joined by commas.
 */
export function frameAncestorsOf(csp: string | null): string[] | null {
  const directive = (csp ?? "")
    .split(/[,;]/)
    .map((part) => part.trim().split(/\s+/))
    .find(([name]) => name.toLowerCase() === "frame-ancestors");
  return directive ? directive.slice(1) : null;
}

/**
 * Asks this deployment for the two files the snippet depends on and checks the headers the
 * browser actually received, so a reverse proxy that drops or overrides them is caught here
 * rather than on the restaurant's site. The admin is served from the same origin and through
 * the same proxy as `/embed`, which is what makes its view of the headers the real one.
 *
 * @see [embedProbe.test.ts](../tests/utils/embedProbe.test.ts): pins each problem, and that a
 * policy listing every allowed site passes.
 */
export async function probeEmbed(origins: string[]): Promise<EmbedProbeResult> {
  if (origins.length === 0) return { ok: false, problem: "noOrigins" };
  try {
    const page = await fetch("/embed", { cache: "no-store" });
    if (!page.ok) return { ok: false, problem: "unreachable" };
    if (page.headers.get("x-frame-options")) return { ok: false, problem: "frameOptions" };
    const ancestors = frameAncestorsOf(page.headers.get("content-security-policy"));
    if (!ancestors || !origins.every((origin) => ancestors.includes(origin))) {
      return { ok: false, problem: "frameAncestors" };
    }

    const loader = await fetch("/embed.js", { cache: "no-store" });
    if (!loader.ok) return { ok: false, problem: "unreachable" };
    const corp = loader.headers.get("cross-origin-resource-policy")?.toLowerCase();
    if (corp === "same-origin" || corp === "same-site") {
      return { ok: false, problem: "loaderBlocked" };
    }
    return { ok: true };
  } catch {
    return { ok: false, problem: "unreachable" };
  }
}
