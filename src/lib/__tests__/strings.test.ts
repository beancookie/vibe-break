import { describe, it, expect } from "vitest";
import { en } from "$lib/i18n.svelte";
import { zh } from "$lib/extra-locales/zh";

describe("en dictionary", () => {
  it("has correct initializing status", () => {
    expect(en.STATUS.INITIALIZING).toBe("Initializing...");
  });

  it("generates loading messages with model name", () => {
    expect(en.STATUS.LOADING_VRM("Furina")).toBe("Loading Furina…");
  });

  it("generates loaded messages with model name", () => {
    expect(en.STATUS.LOADED_VRM("Keqing")).toBe("Loaded Keqing");
  });

  it("generates animation playing messages", () => {
    expect(en.STATUS.ANIM_PLAYING("Idle")).toBe("▶ Idle");
  });

  it("has correct error message", () => {
    expect(en.ERROR.NOT_TAURI).toContain("Tauri runtime");
  });

  it("has menu labels", () => {
    expect(en.UI.LABEL_MODEL).toBe("Model");
    expect(en.UI.LABEL_ANIMATION).toBe("Animation");
  });
});

describe("zh dictionary", () => {
  it("has correct Chinese translations", () => {
    expect(zh.STATUS.INITIALIZING).toBe("初始化中...");
    expect(zh.UI.LABEL_MODEL).toBe("模型");
    expect(zh.UI.LABEL_ANIMATION).toBe("动画");
    expect(zh.STATUS.THINKING).toBe("🤔 思考中...");
    expect(zh.ERROR.NOT_TAURI).toContain("Tauri 运行环境");
  });
});
