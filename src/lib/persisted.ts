import type { Store } from "@tauri-apps/plugin-store";
import { isTauri } from "@tauri-apps/api/core";
import type { McpCounters } from "$lib/stores.svelte";

export interface PersistedState {
  selectedVrm: string;
  selectedAnim: string;
  petScale: number;
  alwaysOnTop: boolean;
  locale: string;
  counters: McpCounters;
}

const DEFAULTS: PersistedState = {
  selectedVrm: "",
  selectedAnim: "",
  petScale: 1.0,
  alwaysOnTop: false,
  locale: "en",
  counters: { filesWritten: 0, commandsRun: 0, errors: 0 },
};

const KEY = "app_state";

let store: Store | null = null;
let storePromise: Promise<Store | null> | null = null;

export async function getStore(): Promise<Store | null> {
  if (store) return store;
  if (storePromise) return storePromise;
  if (!isTauri()) {
    storePromise = Promise.resolve(null);
    return storePromise;
  }
  storePromise = (async () => {
    const { load } = await import("@tauri-apps/plugin-store");
    store = await load("settings.json", { autoSave: false, defaults: {} });
    return store;
  })();
  return storePromise;
}

export async function loadPersistedState(): Promise<PersistedState> {
  const s = await getStore();
  if (!s) return { ...DEFAULTS };
  const saved = await s.get<Partial<PersistedState>>(KEY);
  return { ...DEFAULTS, ...saved };
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  const s = await getStore();
  if (!s) return;
  await s.set(KEY, state);
  await s.save();
}
