<script lang="ts">
  /**
   * Thin Svelte 5 wrapper around three's OrbitControls. All mouse
   * buttons are disabled (left drag = window move, right = context
   * menu) and **wheel zoom is intercepted** to drive
   * `appState.petScale` instead of the camera distance. This way
   * the OS window resizes together with the model.
   */
  import { useTask, useThrelte } from "@threlte/core";
  import { onDestroy, onMount } from "svelte";
  import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import type { PerspectiveCamera, OrthographicCamera } from "three";
  import { appState } from "$lib/stores.svelte";
  import { STATUS } from "$lib/strings";

  const { renderer, camera } = useThrelte();

  let controls: ThreeOrbitControls | null = null;
  const PET_SCALE_MIN = 0.5;
  const PET_SCALE_MAX = 3.0;
  const PET_SCALE_STEP = 1.15;

  $effect(() => {
    const cam = camera.current as
      | PerspectiveCamera
      | OrthographicCamera
      | undefined;
    if (!cam) return;
    const c = new ThreeOrbitControls(cam, renderer.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    // Disable zoom on OrbitControls - we use our own wheel handler
    // that drives appState.petScale.
    c.enableZoom = false;
    // Disable all mouse buttons: the OS window handles drag.
    c.mouseButtons = {
      LEFT: null,
      MIDDLE: null,
      RIGHT: null,
    };
    const [tx, ty, tz] = appState.cameraTarget;
    c.target.set(tx, ty, tz);
    c.update();
    controls = c;
    return () => {
      c.dispose();
      controls = null;
    };
  });

  // React to cameraTarget changes (e.g. when VrmModel loads a new VRM).
  $effect(() => {
    const [tx, ty, tz] = appState.cameraTarget;
    if (!controls) return;
    controls.target.set(tx, ty, tz);
    controls.update();
  });

  useTask(
    () => {
      controls?.update();
    },
    { autoInvalidate: false },
  );

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    // Normalise deltaY: some devices report line vs pixel deltas.
    const dir = e.deltaY > 0 ? -1 : 1;
    const next =
      dir > 0
        ? appState.petScale * PET_SCALE_STEP
        : appState.petScale / PET_SCALE_STEP;
    appState.petScale = Math.max(PET_SCALE_MIN, Math.min(PET_SCALE_MAX, next));
    // Surface the change in the status bar so the user gets feedback
    // that the wheel event was received.
    appState.status = STATUS.ZOOM_PERCENT(Math.round(appState.petScale * 100));
  }

  // Register the wheel handler manually with `passive: false` so that
  // `preventDefault()` actually takes effect. `<svelte:window onwheel>`
  // compiles to a *passive* listener (browsers / WebViews ignore
  // preventDefault in passive listeners), which is why wheel-zoom
  // silently failed before - the OS or the WebView ended up eating
  // the event before our handler could act on it.
  onMount(() => {
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  });

  onDestroy(() => {
    controls?.dispose();
  });
</script>