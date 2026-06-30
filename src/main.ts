import { mount } from "svelte";
import "./app.css";
import VrmViewer from "./components/VrmViewer.svelte";
import { listAssets } from "$lib/three/loadAssets";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { STATUS, ERROR, initStrings } from "$lib/strings";
import "$lib/extra-locales/zh";
import { appState, setVrmList, setAnimList, setScanning, setStatus, setSelectedVrm, setSelectedAnim, setPetScale } from "$lib/stores.svelte";
import { loadPersistedState } from "$lib/persisted";
import { logger } from "$lib/logger";
import { pushNews } from "$lib/stores.svelte";

initStrings(appState);

const target = document.getElementById("app") as HTMLDivElement | null;
if (!target) {
  throw new Error(ERROR.NO_APP_ROOT);
}

const app = mount(VrmViewer, { target });

async function restorePersisted(): Promise<void> {
  const saved = await loadPersistedState();
  if (saved.selectedVrm) setSelectedVrm(saved.selectedVrm);
  if (saved.selectedAnim) setSelectedAnim(saved.selectedAnim);
  if (saved.petScale !== 1.0) setPetScale(saved.petScale);
  if (saved.locale) {
    appState.locale = saved.locale;
  }
  if (saved.counters) {
    appState.counters = { ...appState.counters, ...saved.counters };
  }
  if (saved.alwaysOnTop) {
    setScanning(true);
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setAlwaysOnTop(true);
    } catch (e) { logger.warn("[Init]", "restore alwaysOnTop failed", e); }
  }
}

async function scanAssets(): Promise<void> {
  const all = await listAssets();
  logger.info("[Init]", `scanAssets found ${all.length} total assets`);

  const vrms = all.filter((a) => a.url.toLowerCase().endsWith(".vrm"));
  const vrmas = all.filter((a) => a.url.toLowerCase().endsWith(".vrma"));
  logger.info("[Init]", `scanAssets vrms=${vrms.length} vrmas=${vrmas.length}`);

  if (vrms.length > 0) {
    logger.info("[Init]", `VRM list: ${vrms.map((v) => v.name).join(", ")}`);
  }
  if (vrmas.length > 0) {
    logger.info("[Init]", `VRMA list: ${vrmas.map((a) => a.name).join(", ")}`);
  }

  setVrmList(vrms);
  setAnimList(vrmas);

  if (vrms.length === 0) {
    setStatus(STATUS.NO_MODELS);
    return;
  }

  if (!appState.selectedAnim && vrmas.length > 0) {
    const firstDance = vrmas.find((a) => a.url.includes("/dance/"));
    if (firstDance) setSelectedAnim(firstDance.url);
  }

  if (appState.selectedAnim && vrmas.length > 0) {
    const isDance = vrmas.some(
      (a) => a.url === appState.selectedAnim && a.url.includes("/dance/")
    );
    if (!isDance) {
      const firstDance = vrmas.find((a) => a.url.includes("/dance/"));
      if (firstDance) setSelectedAnim(firstDance.url);
    }
  }

  const idx = vrms.findIndex((v) => v.name === appState.selectedVrm);
  if (idx < 0 && vrms.length > 0) {
    logger.info("[Init]", `auto-select first VRM: ${vrms[0].name}`);
    setSelectedVrm(vrms[0].name);
  }

  setStatus(STATUS.INITIALIZING);
}

async function fetchNews(): Promise<void> {
  if (!isTauri()) return;
  try {
    const items = await invoke<{ title: string; link: string; source: string }[]>("fetch_news");
    items.forEach(pushNews);
    logger.info("[Init]", `loaded ${items.length} news items`);
  } catch (err) {
    logger.warn("[Init]", "fetchNews failed", err);
  }
}

async function startNewsTimer(): Promise<void> {
  await fetchNews();
  setInterval(fetchNews, 10 * 60 * 1000);
  logger.info("[Init]", "news timer started (10 min interval)");
}

async function initBrowserFallback(): Promise<void> {
  setScanning(false);
  setVrmList([]);
  setAnimList([]);
  setStatus(STATUS.BROWSER_PREVIEW);
}

async function init(): Promise<void> {
  if (isTauri()) {
    await restorePersisted();
    try {
      await scanAssets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`${STATUS.SCAN_FAILED} ${msg}`);
      logger.error("[Init]", "scanAssets failed", err);
    } finally {
      setScanning(false);
    }

    const { startMcpBridge } = await import("$lib/mcpBridge.svelte");
    await startMcpBridge();

    startNewsTimer().catch((err) => logger.warn("[Init]", "news timer failed", err));
  } else {
    await initBrowserFallback();
  }
}

init().catch((err) => logger.error("[Init]", "init failed", err));

window.addEventListener("error", (event) => {
  logger.error("[Global]", `uncaught error: ${event.message}`, event.filename, event.lineno, event.colno);
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  logger.error("[Global]", `unhandled rejection: ${reason}`, event.reason);
});

(window as any).__appState = appState;

export default app;