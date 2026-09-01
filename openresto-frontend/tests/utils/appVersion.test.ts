import Constants from "expo-constants";
import { compareVersions, currentAppVersion, isBelowMinimum } from "@/utils/appVersion";

// The real module exposes `expoConfig` as a getter, so the test swaps in a plain object it can
// point at whatever version a build would have baked in — same shape as tests/api/client.test.ts.
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: null } }));

const mutable = Constants as unknown as { expoConfig: unknown };

afterEach(() => {
  mutable.expoConfig = null;
});

describe("compareVersions", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.9.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("1.9.1", "1.9.2")).toBeLessThan(0);
  });

  it("treats identical versions as equal", () => {
    expect(compareVersions("1.9.0", "1.9.0")).toBe(0);
  });

  it("reads a missing segment as zero, so 1.9 and 1.9.0 are the same version", () => {
    expect(compareVersions("1.9", "1.9.0")).toBe(0);
    expect(compareVersions("1.9.1", "1.9")).toBeGreaterThan(0);
  });

  it("reads a non-numeric segment as zero rather than as NaN", () => {
    expect(compareVersions("1.9.0-beta", "1.9.0")).toBe(0);
    expect(compareVersions("", "0.0.0")).toBe(0);
  });
});

describe("isBelowMinimum", () => {
  it("passes a build that exactly meets the minimum", () => {
    expect(isBelowMinimum("1.9.0", "1.9.0")).toBe(false);
  });

  it("fails a build one patch below the minimum", () => {
    expect(isBelowMinimum("1.8.9", "1.9.0")).toBe(true);
  });

  it("passes a build above the minimum", () => {
    expect(isBelowMinimum("1.9.1", "1.9.0")).toBe(false);
  });

  it("passes when no minimum is configured", () => {
    expect(isBelowMinimum("1.0.0", undefined)).toBe(false);
    expect(isBelowMinimum("1.0.0", "")).toBe(false);
  });

  it("passes when the running version is unknown", () => {
    expect(isBelowMinimum(undefined, "1.9.0")).toBe(false);
  });
});

describe("currentAppVersion", () => {
  it("reads the version baked into the build", () => {
    mutable.expoConfig = { name: "t", slug: "t", version: "1.9.0" };
    expect(currentAppVersion()).toBe("1.9.0");
  });

  it("is undefined when the config carries no version", () => {
    expect(currentAppVersion()).toBeUndefined();
  });
});
