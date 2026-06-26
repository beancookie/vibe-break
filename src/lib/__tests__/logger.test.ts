import { describe, it, expect, vi } from "vitest";
import { logger, setLogLevel } from "$lib/logger";

describe("logger", () => {
  it("logs at info level by default", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("[Test]", "hello");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not log debug messages at default level", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.debug("[Test]", "should not appear");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs debug messages when level is set to debug", () => {
    setLogLevel("debug");
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.debug("[Test]", "now visible");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    setLogLevel("info");
  });

  it("formats log messages with tag and message", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("[VRM]", "dispose failed");
    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toContain("[VRM]");
    expect(msg).toContain("dispose failed");
    spy.mockRestore();
  });

  it("passes extra args to console", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const extra = { code: 42 };
    logger.error("[App]", "something broke", extra);
    expect(spy.mock.calls[0][1]).toBe(extra);
    spy.mockRestore();
  });
});
