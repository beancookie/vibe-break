<script lang="ts">
  /**
   * Thin Svelte 5 wrapper around three's OrbitControls. All mouse
   * buttons are disabled (left drag = window move, right = context
   * menu) and **wheel zoom is intercepted** to drive
   * `appState.petScale` instead of the camera distance. This way
   * the OS window resizes together with the model.
   */
  import { useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import * as THREE from "three";
  import { appState } from "$lib/stores.svelte";

  const { renderer, camera } = useThrelte();

  let controls: ThreeOrbitControls | null = null;
  const PET_SCALE_MIN = 0.3;
  const PET_SCALE_MAX = 3.0;
  const PET_SCALE_STEP = 1.15;

  $effect(() => {
    const cam = camera.current as
      | THREE.PerspectiveCamera
      | THREE.OrthographicCamera
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
  }

  onDestroy(() => {
    controls?.dispose();
  });
</script>

<svelte:window onwheel={onWheel} />