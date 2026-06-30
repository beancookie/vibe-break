export type Locale = string;

export interface StatusDict {
  IDLE: string;
  INITIALIZING: string;
  NO_MODELS: string;
  BROWSER_PREVIEW: string;
  SCAN_FAILED: string;
  SCANNING_VRM: string;
  NO_VRMS: string;
  LOADING_VRM: (name: string) => string;
  LOADED_VRM: (name: string) => string;
  VRM_LOAD_FAILED: (url: string, msg: string) => string;
  ANIM_PLAYING: (name: string) => string;
  ANIM_ERROR: (msg: string) => string;
  ZOOM_PERCENT: (pct: number) => string;
  THINKING: string;
  DONE: string;
  ERROR_MSG: string;
  SWITCHING_MODEL: string;
  SWITCHING_ANIM: string;
}

export interface ErrorDict {
  NO_APP_ROOT: string;
  NOT_TAURI: string;
}

export interface UiDict {
  MENU_HEADER: string;
  LABEL_MODEL: string;
  LABEL_ANIMATION: string;
  OPTION_SCANNING: string;
  OPTION_NO_VRM: string;
  OPTION_PICK_ANIM: string;
  BUTTON_ALWAYS_ON_TOP: string;
}

export interface Dict {
  STATUS: StatusDict;
  ERROR: ErrorDict;
  UI: UiDict;
}

export interface LocaleInfo {
  value: string;
  label: string;
}

const dict: Record<string, Dict> = {};
const supportedLocales: LocaleInfo[] = [];

export const en: Dict = {
  STATUS: {
    IDLE: "Idle",
    INITIALIZING: "Initializing...",
    NO_MODELS: "No .vrm models found. Drop files into src-tauri/resources/assets/ and rebuild.",
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
    THINKING: "🤔 Thinking...",
    DONE: "✅ Done!",
    ERROR_MSG: "❌ Error",
    SWITCHING_MODEL: "Switching model…",
    SWITCHING_ANIM: "Switching animation…",
  },
  ERROR: {
    NO_APP_ROOT: "Vibe Break: cannot find #app element in the DOM.",
    NOT_TAURI: "Asset listing requires the Tauri runtime. Run `pnpm tauri dev` instead of `pnpm dev`.",
  },
  UI: {
    MENU_HEADER: "Vibe Break",
    LABEL_MODEL: "Model",
    LABEL_ANIMATION: "Animation",
    OPTION_SCANNING: "scanning…",
    OPTION_NO_VRM: "(no .vrm found)",
    OPTION_PICK_ANIM: "— pick —",
    BUTTON_ALWAYS_ON_TOP: "Always on top",
  },
};

registerLocale("en", en);
registerLocaleInfo({ value: "en", label: "English" });

export function registerLocale(value: string, d: Dict) {
  dict[value] = d;
}

export function registerLocaleInfo(info: LocaleInfo) {
  if (!supportedLocales.some((l) => l.value === info.value)) {
    supportedLocales.push(info);
  }
}

export function getSupportedLocales(): readonly LocaleInfo[] {
  return supportedLocales;
}

export function getDict(locale: string): Dict {
  return dict[locale] ?? dict["en"];
}
