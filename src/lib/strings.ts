export const STATUS = {
  INITIALIZING: "Initializing...",
  NO_MODELS: "No .vrm models found. Drop files into src-tauri/resources/assets/ and rebuild.",
  LOADED: "Loaded - drag to rotate, scroll to zoom",
  BROWSER_PREVIEW: "Browser preview mode. Run `pnpm tauri dev` to load real VRM models.",
  SCAN_FAILED: "Asset scan failed:",
  SCANNING_VRM: "[VRM] scanning…",
  NO_VRMS: "[VRM] no models found",
  LOADING_VRM: (name: string) => `Loading ${name}…`,
  LOADED_VRM: (name: string) => `Loaded ${name}`,
  VRM_LOAD_FAILED: (url: string, msg: string) => `[VRM] load FAILED ${url}: ${msg}`,
  ANIM_PLAYING: (name: string) => `▶ ${name}`,
  ANIM_ERROR: (msg: string) => `Anim error: ${msg}`,
  ZOOM_PERCENT: (pct: number) => `🔍 ${pct}%`,
  // MCP / AI statuses
  THINKING: "🤔 Thinking...",
  DONE: "✅ Done!",
  ERROR_MSG: "❌ Error",
  IDLE: "Idle",
  FILE_WRITTEN: (n: number) => `📝 Files written: ${n}`,
  COMMAND_RUN: (n: number) => `⚡ Commands run: ${n}`,
} as const;

export const ERROR = {
  NO_APP_ROOT: "Vibe Break: cannot find #app element in the DOM.",
  NOT_TAURI: "Asset listing requires the Tauri runtime. Run `pnpm tauri dev` instead of `pnpm dev`.",
} as const;

export const UI = {
  MENU_HEADER: "Vibe Break",
  LABEL_MODEL: "Model",
  LABEL_ANIMATION: "Animation",
  OPTION_SCANNING: "scanning…",
  OPTION_NO_VRM: "(no .vrm found)",
  OPTION_PICK_ANIM: "— pick —",
  BUTTON_REPLAY: "Replay animation",
  BUTTON_STOP: "Stop animation",
  BUTTON_ALWAYS_ON_TOP: "Always on top",
} as const;
