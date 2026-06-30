import { registerLocale, registerLocaleInfo, type Dict } from "$lib/i18n.svelte";

export const zh: Dict = {
  STATUS: {
    IDLE: "空闲",
    INITIALIZING: "初始化中...",
    NO_MODELS: "未找到 .vrm 模型。将文件放入 src-tauri/resources/assets/ 并重新构建。",
    BROWSER_PREVIEW: "浏览器预览模式。运行 `pnpm tauri dev` 加载 VRM 模型。",
    SCAN_FAILED: "资产扫描失败：",
    SCANNING_VRM: "[VRM] 扫描中…",
    NO_VRMS: "[VRM] 未找到模型",
    LOADING_VRM: (name: string) => `正在加载 ${name}…`,
    LOADED_VRM: (name: string) => `已加载 ${name}`,
    VRM_LOAD_FAILED: (url: string, msg: string) => `[VRM] 加载失败 ${url}: ${msg}`,
    ANIM_PLAYING: (name: string) => `▶ ${name}`,
    ANIM_ERROR: (msg: string) => `动画错误：${msg}`,
    ZOOM_PERCENT: (pct: number) => `🔍 ${pct}%`,
    THINKING: "🤔 思考中...",
    DONE: "✅ 完成！",
    ERROR_MSG: "❌ 错误",
    SWITCHING_MODEL: "切换模型中…",
    SWITCHING_ANIM: "切换动画中…",
  },
  ERROR: {
    NO_APP_ROOT: "Vibe Break: 找不到 #app 元素。",
    NOT_TAURI: "资产列表需要 Tauri 运行环境。请运行 `pnpm tauri dev` 而非 `pnpm dev`。",
  },
  UI: {
    MENU_HEADER: "Vibe Break",
    LABEL_MODEL: "模型",
    LABEL_ANIMATION: "动画",
    OPTION_SCANNING: "扫描中…",
    OPTION_NO_VRM: "(未找到 .vrm)",
    OPTION_PICK_ANIM: "— 选择 —",
    BUTTON_ALWAYS_ON_TOP: "窗口置顶",
  },
};

registerLocale("zh", zh);
registerLocaleInfo({ value: "zh", label: "中文" });
