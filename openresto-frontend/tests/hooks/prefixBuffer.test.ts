import { resolvePrefixKey, GOPHER_PREFIX, GOPHER_TIMEOUT_MS } from "@/hooks/prefixBuffer";

describe("resolvePrefixKey", () => {
  it("dispatches a plain key when no prefix is pending", () => {
    expect(resolvePrefixKey(null, "?")).toEqual({ dispatchKey: "?" });
    expect(resolvePrefixKey(null, "l")).toEqual({ dispatchKey: "l" });
    expect(resolvePrefixKey(null, "Escape")).toEqual({ dispatchKey: "Escape" });
  });

  it("starts a prefix window when 'g' arrives with no pending prefix", () => {
    expect(resolvePrefixKey(null, "g")).toEqual({ startPrefix: true });
  });

  it("dispatches 'g <key>' and resets when a key follows a pending 'g'", () => {
    expect(resolvePrefixKey(GOPHER_PREFIX, "d")).toEqual({
      dispatchKey: "g d",
      reset: true,
    });
    expect(resolvePrefixKey(GOPHER_PREFIX, "b")).toEqual({
      dispatchKey: "g b",
      reset: true,
    });
  });

  it("treats a second 'g' as a completed 'g g' sequence, not a new prefix", () => {
    // pending "g" + "g" → dispatch "g g" and reset (matches original handler logic)
    expect(resolvePrefixKey(GOPHER_PREFIX, "g")).toEqual({
      dispatchKey: "g g",
      reset: true,
    });
  });

  it("always resets after consuming a pending prefix", () => {
    const decision = resolvePrefixKey(GOPHER_PREFIX, "x");
    expect(decision.reset).toBe(true);
    expect(decision.dispatchKey).toBe("g x");
  });

  it("never sets startPrefix when a prefix is already pending", () => {
    // The pending branch returns dispatchKey+reset, never startPrefix
    const decision = resolvePrefixKey(GOPHER_PREFIX, "d");
    expect(decision.startPrefix).toBeUndefined();
  });

  it("never sets reset when starting a new prefix", () => {
    const decision = resolvePrefixKey(null, "g");
    expect(decision.reset).toBeUndefined();
    expect(decision.dispatchKey).toBeUndefined();
  });

  it("exports the prefix constant and timeout for caller use", () => {
    expect(GOPHER_PREFIX).toBe("g");
    expect(GOPHER_TIMEOUT_MS).toBe(1500);
  });
});
