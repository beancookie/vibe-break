import { Object3D } from "three";
import type { AssetEntry } from "$lib/types";
import { STATUS } from "$lib/strings";

export type { AssetEntry };

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
  newsIndex: 0,
  showNews: false,
  mcpUi: {
    showNews: false,
    showEncouragement: false,
    showErrorFeedback: false,
    errorMsg: "",
  } as McpUiState,
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

/**
 * Shared world-space Object3D that VRM models look at (head/eye tracking).
 */
export const lookTarget = new Object3D();
lookTarget.position.set(0, 1.2, 0);