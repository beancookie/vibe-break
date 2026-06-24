<script lang="ts">
  import { useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    AnimationMixer,
    Box3,
    LoopRepeat,
    Vector3,
    type AnimationClip,
    type PerspectiveCamera,
  } from "three";
  import { VRM } from "@pixiv/three-vrm";
  import { loadVRM, loadVRMAClip, disposeVRM } from "$lib/three/useVrm";
  import { appState, lookTarget } from "$lib/stores.svelte";
  import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

  const { scene, camera } = useThrelte();

  // Non-reactive THREE objects (kept out of $state intentionally).
  let current: VRM | null = null;
  let mixer: AnimationMixer | null = null;
  const clipCache = new Map<string, Promise<AnimationClip>>();
  let loadToken = 0;
  let animToken = 0;
  let lastLoadedIdx = -1;

  // Debounce: if the user mashes the model <select>, only honour the
  // final pick. Without this each click kicks off a full load pipeline
  // (fetch 40 MB + parse 1–3 s) and they all run in parallel.
  const SWITCH_DEBOUNCE_MS = 200;
  let switchTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingIdx = -1;

  // Reusable scratch vectors/box.
  const _v3a = new Vector3();
  const _v3b = new Vector3();
  const _v3c = new Vector3();
  const _v3d = new Vector3();
  const _v3e = new Vector3();
  const _box = new Box3();

  function stopMixer() {
    if (!mixer) return;
    mixer.stopAllAction();
    mixer.setTime(0);
  }

  /**
   * Yield to the browser so it can paint / process input between the
   * heavy phases of the load pipeline. Mirrors `useVrm.ts`.
   */
  const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

  /**
   * Frame the camera so the model is fully visible regardless of its
   * actual height. Reads the human bone positions (head, hips, feet)
   * to compute a target and distance that fits the model.
   */
  function frameVRM(vrm: VRM) {
    const cam = camera.current as PerspectiveCamera | undefined;
    if (!cam) return;

    const headY =
      vrm.humanoid?.getNormalizedBoneNode("head")?.getWorldPosition(_v3a).y ?? null;
    const hipsY =
      vrm.humanoid?.getNormalizedBoneNode("hips")?.getWorldPosition(_v3b).y ?? null;
    const feetY =
      vrm.humanoid
        ?.getNormalizedBoneNode("leftFoot")
        ?.getWorldPosition(_v3c).y ??
      vrm.humanoid?.getNormalizedBoneNode("rightFoot")?.getWorldPosition(_v3d).y ??
      null;

    let top: number;
    let bottom: number;
    if (headY !== null && feetY !== null) {
      top = headY;
      bottom = feetY;
    } else {
      _box.setFromObject(vrm.scene);
      top = _box.max.y;
      bottom = _box.min.y;
    }

    const centerY =
      hipsY !== null && headY !== null ? (headY + hipsY) / 2 : (top + bottom) / 2;
    const height = Math.max(0.1, top - bottom);

    const fovRad = (cam.fov * Math.PI) / 180;
    // The window is locked to a 3:4 (W:H) aspect, so fitting the body
    // height is what makes the model readable. A small horizontal
    // multiplier (1.2) pushes the camera slightly further back so
    // wider characters (e.g. models with spread arms / hair) don't
    // get clipped on the sides of the narrow window.
    const fitDistance =
      (height / 2 / Math.tan(fovRad / 2)) * 1.6;
    const distance = Math.max(fitDistance, 0.6);

    const dir = _v3e.set(cam.position.x, 0, cam.position.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();

    // Look at a point below the head so the head sits near the top
    // of the frame and the feet trail off the bottom. The target is
    // `headY - 0.45 * height` which empirically puts the head near
    // the top edge.
    const targetY = (headY ?? top) - height * 0.4;
    cam.position.set(
      dir.x * distance,
      targetY + height * 0.4,
      dir.z * distance,
    );
    cam.lookAt(0, targetY, 0);
    cam.updateProjectionMatrix();

    appState.cameraTarget = [0, targetY, 0];

    // Cache the natural height so the petScale effect can recompute
    // the window size when the user zooms.
    lastNaturalHeight = height;

    // Resize the OS window to closely fit the model.
    resizeWindowToVRM(vrm, height);
  }

  /**
   * Resize the OS window to closely fit the model's bounding box.
   * The displayed size is the model's natural size multiplied by the
   * user-controlled petScale so wheel-zoom feels consistent with the
   * window size.
   *
   * Width is derived from the height to keep a fixed 3:4 (W:H) aspect
   * ratio, matching the Rust-side `WINDOW_ASPECT_W_OVER_H` constraint.
   * That way both code paths produce the same shape and the OS-level
   * resize event (which the Rust hook corrects) never has to fight
   * the JS one.
   */
  function resizeWindowToVRM(vrm: VRM, naturalHeight: number) {
    const scale = appState.petScale;
    _box.setFromObject(vrm.scene);
    const modelHeight = naturalHeight * scale;

    const PX_PER_UNIT = 360;
    // Top margin is 0 so the head sits at the very top edge; bottom
    // margin is large because the camera is framed to push the feet
    // below the viewport. The two side margins are kept symmetric.
    const marginH = 32;

    // Compute height from the model's natural height, then derive the
    // width from a fixed 3:4 (W:H) ratio.
    const h = Math.max(
      400,
      Math.min(1800, Math.round(modelHeight * PX_PER_UNIT) + marginH * 2),
    );
    const w = Math.max(180, Math.min(1200, Math.round(h * 0.75)));

    getCurrentWindow()
      .setSize(new LogicalSize(w, h))
      .catch((err: unknown) => console.warn("setSize failed", err));
  }

  /**
   * Perform the actual model load + swap. Called both directly and
   * from the debounce timer. Bails out if `idx` is no longer the
   * currently-selected model (e.g. the user picked something else
   * during the debounce window).
   */
  function startLoad(idx: number) {
    if (idx === lastLoadedIdx) return;
    if (idx < 0 || idx >= appState.vrmList.length) return;
    lastLoadedIdx = idx;
    const meta = appState.vrmList[idx];
    const myToken = ++loadToken;

    // Capture the old model so we can dispose it once the new one is
    // ready, then immediately drop it from the scene so the user sees
    // instant feedback (the window goes transparent while loading).
    const oldVrm = current;
    current = null;
    if (oldVrm) {
      scene.remove(oldVrm.scene);
    }
    stopMixer();
    mixer = null;
    clipCache.clear();
    currentRev++; // tell the anim effect to drop its dep

    appState.status = `Loading ${meta.name}…`;
    appState.isLoading = true;

    loadVRM(meta.url)
      .then(async (vrm: VRM) => {
        if (myToken !== loadToken) {
          // A newer load has been kicked off; just dispose this one in
          // the background and bail.
          disposeVRM(vrm);
          return;
        }
        // The new model is ready - swap it in. The previous model (if
        // any) was already removed from the scene; now we can finally
        // release its GPU resources. disposeVRM defers the actual
        // deepDispose to a later task so it doesn't freeze the frame
        // we're about to draw.
        if (oldVrm) {
          disposeVRM(oldVrm);
        }
        current = vrm;
        scene.add(vrm.scene);
        currentRev++; // notify the anim effect

        if (vrm.lookAt) vrm.lookAt.target = lookTarget;

        // updateMatrixWorld walks the whole scene graph; for a 40 MB
        // VRM with thousands of Object3Ds that's 50–150 ms of blocking
        // work. yieldToMain first so the "Loaded X" status has a
        // chance to render before we keep the main thread busy.
        await yieldToMain();
        if (myToken !== loadToken) return;
        vrm.scene.updateMatrixWorld(true);
        frameVRM(vrm);

        appState.status = `Loaded ${meta.name}`;
        appState.isLoading = false;
      })
      .catch((e: unknown) => {
        if (myToken !== loadToken) {
          // A newer load superseded us; the previous-model dispose
          // for the winning request will run there. Nothing to do.
          return;
        }
        const msg = e instanceof Error ? (e.message || e.name || "Error") : String(e);
        appState.status = `[VRM] load FAILED ${meta.url}: ${msg}`;
        appState.isLoading = false;
        // We failed before we could replace the old model - free its
        // GPU resources now so the user can retry without leaking.
        if (oldVrm) {
          disposeVRM(oldVrm);
        }
        // Treat the failed model as "not loaded" so the next pick
        // (or re-select of the same one) will re-enter startLoad.
        lastLoadedIdx = -1;
      });
  }

  // ---- Selected VRM -> debounced load + dispose ----
  $effect(() => {
    const idx = appState.selectedVrm;
    if (appState.scanning) {
      appState.status = `[VRM] scanning…`;
      return;
    }
    if (appState.vrmList.length === 0) {
      appState.status = `[VRM] no models found`;
      return;
    }
    if (idx < 0 || idx >= appState.vrmList.length) return;
    if (idx === lastLoadedIdx) return;

    // Debounce: only the final selection within SWITCH_DEBOUNCE_MS
    // actually runs. If startLoad is already mid-flight, the
    // loadToken bump inside it will obsolete the older request.
    pendingIdx = idx;
    if (switchTimer !== null) clearTimeout(switchTimer);
    switchTimer = setTimeout(() => {
      switchTimer = null;
      const target = pendingIdx;
      pendingIdx = -1;
      startLoad(target);
    }, SWITCH_DEBOUNCE_MS);
  });

  // ---- Selected animation -> play on current VRM ----
  // `currentRev` is a monotonic counter that bumps every time a new
  // VRM is loaded. The animation effect reads it as a dep so it
  // re-runs when the model becomes available - that fixes the race
  // where the user (or main.ts) picks an animation before the model
  // finishes loading.
  let currentRev = $state(0);
  $effect(() => {
    const url = appState.selectedAnim;
    // currentRev is a Svelte state used purely as a re-run trigger
    // when a new VRM is loaded - reading it is enough to register
    // the dependency.
    currentRev;
    if (!url || !current) return;
    const vrm = current;
    const name = appState.animList.find((a) => a.url === url)?.name ?? "?";
    const myAnimToken = ++animToken;

    let cached = clipCache.get(url);
    if (!cached) {
      cached = loadVRMAClip(url, vrm);
      clipCache.set(url, cached);
    }
    const promise = cached;

    promise
      .then((clip: AnimationClip) => {
        if (myAnimToken !== animToken) return;
        if (current !== vrm) return;
        if (!mixer) mixer = new AnimationMixer(vrm.scene);
        stopMixer();
        const action = mixer.clipAction(clip, vrm.scene);
        action.reset();
        action.setLoop(LoopRepeat, Infinity);
        action.play();
        appState.status = `▶ ${name}`;
      })
      .catch((e: unknown) => {
        if (myAnimToken !== animToken) return;
        appState.status = `Anim error: ${(e as Error).message}`;
        console.error(e);
      });
  });

  // ---- Stop button -> stop the mixer ----
  $effect(() => {
    appState.stopToken;
    stopMixer();
  });

  // ---- petScale: user-controlled model+window zoom ----
  // Apply the user-controlled scale to the model's scene and resize
  // the OS window to match. The natural height is captured in
  // `lastNaturalHeight` (set after frameVRM runs).
  let lastNaturalHeight = 0.5;
  $effect(() => {
    if (current) {
      const s = appState.petScale;
      current.scene.scale.setScalar(s);
    }
  });
  // When scale changes, resize the window. We can't read appState
  // inside the previous effect after setting the scale (that would
  // re-fire), so this effect depends on petScale alone and uses the
  // cached natural height + current vrm.
  $effect(() => {
    void appState.petScale; // register dep
    if (current && lastNaturalHeight > 0) {
      resizeWindowToVRM(current, lastNaturalHeight);
    }
  });

  // ---- Per-frame update ----
  useTask((dt: number) => {
    current?.update(dt);
    mixer?.update(dt);
  });

  onDestroy(() => {
    if (switchTimer !== null) {
      clearTimeout(switchTimer);
      switchTimer = null;
    }
    if (current) {
      scene.remove(current.scene);
      disposeVRM(current);
      current = null;
    }
    stopMixer();
    mixer = null;
  });
</script>