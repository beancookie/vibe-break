import { describe, it, expect } from "vitest";
import { STATUS, ERROR, UI } from "$lib/strings";

describe("STATUS", () => {
  it("has a default initializing status", () => {
    expect(STATUS.INITIALIZING).toBe("Initializing...");
  });

  it("generates loading messages with model name", () => {
    expect(STATUS.LOADING_VRM("Furina")).toBe("Loading Furina…");
  });

  it("generates loaded messages with model name", () => {
    expect(STATUS.LOADED_VRM("Keqing")).toBe("Loaded Keqing");
  });

  it("generates animation playing messages", () => {
    expect(STATUS.ANIM_PLAYING("Idle")).toBe("▶ Idle");
  });
});

describe("ERROR", () => {
  it("has a not-tauri error message", () => {
    expect(ERROR.NOT_TAURI).toContain("Tauri runtime");
  });
});

describe("UI", () => {
  it("has menu labels", () => {
    expect(UI.LABEL_MODEL).toBe("Model");
    expect(UI.LABEL_ANIMATION).toBe("Animation");
  });
});
