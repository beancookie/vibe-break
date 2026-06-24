import { mount } from "svelte";
import VrmViewer from "./components/VrmViewer.svelte";
import { listAssets } from "$lib/three/loadAssets";
import { isTauri } from "$lib/three/tauri";
import { appState } from "$lib/stores.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("Missing #app root element");

const app = mount(VrmViewer, { target });

// Kick off the asset scan in parallel with the UI mounting.
if (isTauri()) {
  listAssets()
    .then((all) => {
      const vrms = all.filter((a) => a.url.toLowerCase().endsWith(".vrm"));
      const vrmas = all.filter((a) => a.url.toLowerCase().endsWith(".vrma"));
      appState.vrmList = vrms;
      appState.animList = vrmas;
      appState.scanning = false;
      if (vrms.length === 0) {
        appState.status =
          "No .vrm models found. Drop files into src-tauri/resources/assets/ and rebuild.";
        return;
      }
      // Auto-pick the first animation so the pet comes alive on
      // startup. VrmModel reacts to selectedAnim changes and starts
      // playing automatically.
      if (vrmas.length > 0) {
        appState.selectedAnim = vrmas[0].url;
      }
      appState.status = "Loaded - drag to rotate, scroll to zoom";
    })
    .catch((err) => {
      appState.scanning = false;
      appState.status = `Asset scan failed: ${(err as Error).message ?? err}`;
      console.error(err);
    });
} else {
  // Browser fallback.
  appState.scanning = false;
  appState.vrmList = [];
  appState.animList = [];
  appState.status =
    "Browser preview mode. Run `pnpm tauri dev` to load real VRM models.";
}

export default app;