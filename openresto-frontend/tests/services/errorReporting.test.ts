import { logError } from "@/services/errorReporting";

describe("errorReporting.logError", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("does not throw for an Error input", () => {
    expect(() => logError(new Error("boom"))).not.toThrow();
  });

  it("does not throw for a string input", () => {
    expect(() => logError("a string failure")).not.toThrow();
  });

  it("does not throw for an unknown (non-Error) input", () => {
    expect(() => logError({ weird: "value" })).not.toThrow();
    expect(() => logError(42)).not.toThrow();
    expect(() => logError(null)).not.toThrow();
  });

  it("accepts context without error", () => {
    expect(() => logError(new Error("ctx"), { screen: "lookup", action: "cancel" })).not.toThrow();
  });

  it("is silent in the test env (NODE_ENV === 'test')", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    process.env.NODE_ENV = "test";
    logError(new Error("should not log"));
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("logs to console.error outside the test env", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    process.env.NODE_ENV = "production";
    logError(new Error("should log"));
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][1]).toHaveProperty("message", "should log");
    consoleSpy.mockRestore();
  });
});
