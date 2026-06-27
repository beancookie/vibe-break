import { STATUS } from "$lib/strings";
import { devLog } from "$lib/devLog";

export interface AssetEntry {
  name: string;
  url: string;
}

export interface McpCounters {
  filesWritten: number;
  commandsRun: number;
  errors: number;
}

export interface ThinkingPeriod {
  start: number;
  end?: number;
}

export interface McpUiState {
  showNews: boolean;
  showEncouragement: boolean;
  showErrorFeedback: boolean;
  errorMsg: string;
}

export interface NewsItem {
  title: string;
  link?: string;
  source: string;
  published?: string;
}

export interface PendingExpression {
  name: string;
  weight: number;
}

export interface PendingBonePose {
  bone: string;
  x: number;
  y: number;
  z: number;
}

export type AiState = "idle" | "thinking" | "done" | "error";

export const appState = $state({
  selectedVrm: "",
  selectedAnim: "",
  stopToken: 0,
  cameraTarget: [0, 1.2, 0] as [number, number, number],
  status: STATUS.INITIALIZING as string,
  isLoading: false,
  vrmList: [] as AssetEntry[],
  animList: [] as AssetEntry[],
  scanning: true,
  petScale: 1.0,
  alwaysOnTop: false,

  // AI / MCP state
  aiState: "idle" as AiState,
  counters: { filesWritten: 0, commandsRun: 0, errors: 0 } as McpCounters,
  thinkingPeriods: [] as ThinkingPeriod[],
  thinkingStart: 0,
  news: [] as NewsItem[],
  showNews: false,
  mcpUi: {
    showNews: false,
    showEncouragement: false,
    showErrorFeedback: false,
    errorMsg: "",
    encourageMessage: "",
  } as McpUiState,

  // Mouth / speaking animation
  mouthWeight: 0 as number,

  // Action commands from MCP
  pendingExpression: null as PendingExpression | null,
  pendingBonePose: null as PendingBonePose | null,
});

export function setVrmList(list: AssetEntry[]) {
  appState.vrmList = list;
}
export function setAnimList(list: AssetEntry[]) {
  appState.animList = list;
}
export function setScanning(v: boolean) {
  appState.scanning = v;
}
export function setStatus(msg: string) {
  appState.status = msg;
}
export function setLoading(v: boolean) {
  appState.isLoading = v;
}
export function setSelectedVrm(name: string) {
  appState.selectedVrm = name;
}
export function setSelectedAnim(url: string) {
  appState.selectedAnim = url;
}
export function setPetScale(s: number) {
  appState.petScale = s;
}
export function setCameraTarget(t: [number, number, number]) {
  appState.cameraTarget = t;
}
export function bumpStopToken() {
  appState.stopToken++;
}

export const MAX_NEWS = 50;

export function pushNews(item: NewsItem) {
  if (appState.news.some((n) => n.title === item.title)) return;
  devLog("stores", "pushNews", item.title);
  appState.news = [...appState.news, item];
  if (appState.news.length > MAX_NEWS) {
    const removed = appState.news.length - MAX_NEWS;
    appState.news = appState.news.slice(removed);
  }
}

export function removeNews(text: string) {
  const i = appState.news.findIndex(
    (n) => "[" + n.source + "] " + n.title === text
  );
  if (i === -1) return;
  appState.news = [...appState.news.slice(0, i), ...appState.news.slice(i + 1)];
  devLog("stores", "removeNews", text, "remaining:", appState.news.length);
}

export function recycleNews(text: string, link?: string) {
  const i = appState.news.findIndex(
    (n) => "[" + n.source + "] " + n.title === text
  );
  if (i !== -1) {
    const item = appState.news[i];
    appState.news = [...appState.news.slice(0, i), ...appState.news.slice(i + 1), item];
    devLog("stores", "recycleNews", text);
    return;
  }
  const match = text.match(/^\[(.+?)\]\s(.+)$/);
  if (!match) return;
  appState.news = [...appState.news, { source: match[1], title: match[2], link }];
  devLog("stores", "recycleNews (rebuilt)", text);
}


