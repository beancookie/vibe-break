import { mount } from "svelte";
import "./app.css";
import VrmViewer from "./components/VrmViewer.svelte";
import { listAssets } from "$lib/three/loadAssets";
import { isTauri } from "$lib/runtime";
import { STATUS, ERROR } from "$lib/strings";
import { appState, setVrmList, setAnimList, setScanning, setStatus, setSelectedVrm, setSelectedAnim, setPetScale } from "$lib/stores.svelte";
import { loadPersistedState } from "$lib/persisted";
import { logger } from "$lib/logger";

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
  const vrms = all.filter((a) => a.url.toLowerCase().endsWith(".vrm"));
  const vrmas = all.filter((a) => a.url.toLowerCase().endsWith(".vrma"));
  setVrmList(vrms);
  setAnimList(vrmas);

  if (vrms.length === 0) {
    setStatus(STATUS.NO_MODELS);
    return;
  }

  if (!appState.selectedAnim && vrmas.length > 0) {
    setSelectedAnim(vrmas[0].url);
  }

  const idx = vrms.findIndex((v) => v.name === appState.selectedVrm);
  if (idx < 0 && vrms.length > 0) {
    setSelectedVrm(vrms[0].name);
  }

  setStatus(STATUS.LOADED);
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

    // Start MCP bridge and animation controller.
    const { startMcpBridge } = await import("$lib/mcpBridge.svelte");
    const { startAnimationController } = await import("$lib/animationController.svelte");
    await startMcpBridge();
    startAnimationController();
  } else {
    await initBrowserFallback();
  }
}

init().catch((err) => logger.error("[Init]", "init failed", err));

export default app;