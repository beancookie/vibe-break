<script lang="ts">
  import { Canvas } from "@threlte/core";
  import * as THREE from "three";
  import Scene from "./Scene/Scene.svelte";
  import VrmContextMenu from "./UI/VrmContextMenu.svelte";
  import Barrage from "./UI/Barrage.svelte";
  import EncouragementBubble from "./UI/EncouragementBubble.svelte";
  import { appState } from "$lib/stores.svelte";
  import { savePersistedState } from "$lib/persisted";
  import { isTauri } from "@tauri-apps/api/core";

  // Persist selected settings back to the Tauri store whenever they
  // change. Runs only in the Tauri runtime (the import of
  // @tauri-apps/plugin-store is lazily loaded inside savePersistedState).
  let persistedJson = $state("");
  $effect(() => {
    if (!isTauri()) return;
    appState.selectedVrm;
    appState.selectedAnim;
    appState.petScale;
    queueMicrotask(() => {
      const next = JSON.stringify({
        selectedVrm: appState.selectedVrm,
        selectedAnim: appState.selectedAnim,
        petScale: appState.petScale,
        alwaysOnTop: appState.alwaysOnTop,
      });
      if (next === persistedJson) return;
      persistedJson = next;
      savePersistedState(JSON.parse(next));
    });
  });

  // Custom WebGLRenderer with the right options for a transparent
  // Tauri WebView. The defaults (premultipliedAlpha: true) make the
  // background render as black on Tauri 2 + Windows because the DComp
  // swap chain expects straight (non-premultiplied) alpha.
  const createRenderer = (canvas: HTMLCanvasElement) =>
    new THREE.WebGLRenderer({
      canvas,
      powerPreference: "high-performance",
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
</script>

<!-- Host div lets us style the Threlte wrapper via :global() below. -->
<div class="canvas-host">
  <Canvas {createRenderer}>
    <Scene />
  </Canvas>

  {#if appState.isLoading}
    <div class="loading-overlay" aria-hidden="true">
      <div class="spinner"></div>
    </div>
  {/if}
</div>

<!-- Right-click anywhere to open the control menu. -->
<VrmContextMenu />
<Barrage />
<EncouragementBubble />

<style>
  /* Reset the entire page to transparent so the Tauri WebView
     composes correctly. */
  :global(html),
  :global(body),
  :global(#app) {
    margin: 0;
    padding: 0;
    background: transparent;
    background-color: rgba(0, 0, 0, 0);
    overflow: hidden;
  }

  /* Our host wrapper. */
  .canvas-host {
    position: fixed;
    inset: 0;
    background: transparent;
  }

  /* Threlte <Canvas> renders a single unnamed <div> inside our host.
     That wrapper's default background is the issue: even though the
     canvas inside clears with alpha=0, the wrapper div paints over
     the cleared pixels with its default opaque background.
     Force the wrapper + canvas to transparent via :global() selectors
     scoped to .canvas-host. */
  :global(.canvas-host > div) {
    background: transparent !important;
  }
  :global(.canvas-host > div > canvas) {
    display: block;
    background: transparent !important;
  }

  /* ---- Loading indicator ---- */
  /* The overlay sits above the canvas but below the right-click
     context menu (which is z-index 1000). The spinner itself is a
     pure CSS animation so it keeps ticking even while the main
     thread is busy parsing the new VRM. */
  .loading-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(255, 255, 255, 0.15);
    border-top-color: rgba(255, 255, 255, 0.85);
    border-radius: 50%;
    animation: vrm-spin 0.9s linear infinite;
    /* Subtle drop shadow so the spinner is visible against light
       desktop backgrounds as well as dark ones. */
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  @keyframes vrm-spin {
    to {
      transform: rotate(360deg);
    }
  }

</style>