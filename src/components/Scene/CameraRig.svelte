<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import {
    PerspectiveCamera,
    Vector2,
    Vector3,
    ACESFilmicToneMapping,
  } from "three";
  import OrbitControls from "./OrbitControls.svelte";
  import { appState, lookTarget } from "$lib/stores.svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  const { renderer, camera } = useThrelte();

  // Configure renderer once. Clear with alpha=0 so the WebView
  // shows the desktop through (requires `transparent: true` in
  // tauri.conf.json + `premultipliedAlpha: false` on the renderer).
  $effect(() => {
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
  });

  const mouse = new Vector2(0, 0);
  let lastMouseX = 0;
  let lastMouseY = 0;
  const _ndc = new Vector3();
  const _dir = new Vector3();

  useTask(() => {
    const cam = camera.current;
    if (!cam || !("fov" in cam)) return;
    if (mouse.x === lastMouseX && mouse.y === lastMouseY) return;
    lastMouseX = mouse.x;
    lastMouseY = mouse.y;
    _ndc.set(mouse.x, mouse.y, 0.5).unproject(cam as PerspectiveCamera);
    _dir.copy(_ndc).sub(cam.position).normalize();
    lookTarget.position.copy(cam.position).addScaledVector(_dir, 2.0);
    const baseY = appState.cameraTarget[1];
    lookTarget.position.y = Math.max(
      baseY - 0.3,
      Math.min(baseY + 0.5, lookTarget.position.y),
    );
  });

  $effect(() => {
    const [, y] = appState.cameraTarget;
    if (Math.abs(lookTarget.position.y - y) < 1.5) {
      lookTarget.position.y = y;
    }
  });

  // ----- Window drag (long-press + move) -----
  // Only start dragging the OS window once the user has actually moved
  // the mouse past a small threshold, or held the button long enough.
  // A quick click (no movement, < 150ms) is a no-op so it can be used
  // for future interactive UI (head pats, expression triggers, etc).
  let downX = 0;
  let downY = 0;
  let dragging = false;
  let pressTimer: number | null = null;
  const DRAG_THRESHOLD_PX = 4;
  const LONG_PRESS_MS = 150;

  async function beginDrag() {
    if (dragging) return;
    dragging = true;
    try {
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.warn("startDragging failed", err);
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // left button only
    downX = e.clientX;
    downY = e.clientY;
    dragging = false;
    // Long-press fallback: even if the user doesn't move, holding the
    // button past LONG_PRESS_MS still starts a drag.
    pressTimer = window.setTimeout(beginDrag, LONG_PRESS_MS);
  }

  function onMouseUp() {
    if (pressTimer !== null) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    dragging = false;
  }

  function onMove(e: MouseEvent) {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    // If the user has pressed the left button and moved past the
    // threshold, start a drag. The Tauri runtime will then take over
    // mouse events until pointerup.
    if (pressTimer !== null || dragging) {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        if (pressTimer !== null) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        void beginDrag();
      }
    }
  }
</script>

<svelte:window
  onmousemove={onMove}
  onmousedown={onMouseDown}
  onmouseup={onMouseUp}
/>

<T
  is={PerspectiveCamera}
  makeDefault
  position={[0, 1.2, 3.0]}
  fov={30}
  near={0.1}
  far={100}
  oncreate={(ref) => ref.lookAt(0, 1.2, 0)}
>
  <OrbitControls />
</T>