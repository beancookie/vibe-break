<script lang="ts">
  import { useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    AnimationAction,
    AnimationMixer,
    Box3,
    LoopPingPong,
    Vector3,
    type AnimationClip,
    type PerspectiveCamera,
  } from "three";
  import { VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
  import { loadVRM, loadVRMAClip, disposeVRM } from "$lib/three/useVrm";
  import { appState, setStatus, setLoading, setCameraTarget, setSelectedAnim } from "$lib/stores.svelte";
  import { STATUS } from "$lib/strings";
  import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
  import { logger } from "$lib/logger";

  function errorMessage(e: unknown): string {
    return e instanceof Error ? (e.message || e.name || "Error") : String(e);
  }

  const { scene, camera } = useThrelte();

  // Loading state for the inline spinner (true from startLoad until
  // the first animation is playing and the model is visible).
  let modelLoading = $state(true);

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

  // Cross-fade duration when switching animations. Hard-cutting
  // (`stopAllAction` + `play`) shows a single bind-pose frame because
  // the old action is dropped before the new one's first `update(dt)`
  // has run, leaving bones momentarily on the rig's rest pose.
  // Fading old → new keeps the bones interpolating continuously and
  // also masks any awkward t=0 pose in the incoming VRMA.
  const ANIM_CROSSFADE_S = 0.2;
  // The animation that's currently driving the model. Tracked
  // explicitly (rather than by digging into `mixer._actions`) so the
  // cross-fade has a clear source-of-truth and works on the very
  // first animation (when mixer._actions is effectively empty
  // weight-wise).
  let currentAction: AnimationAction | null = null;

  // Reusable scratch vectors/box.
  const _v3a = new Vector3();
  const _v3c = new Vector3();
  const _v3d = new Vector3();
  const _v3e = new Vector3();
  const _box = new Box3();

  function stopMixer() {
    if (!mixer) return;
    mixer.stopAllAction();
    mixer.setTime(0);
    currentAction = null;
  }

  function disposeMixer(vrm: VRM | null) {
    if (!mixer) return;
    if (vrm) mixer.uncacheRoot(vrm.scene);
    mixer.stopAllAction();
    mixer = null;
    currentAction = null;
  }

  let lastNaturalHeight = $state(1);
  let lastCameraTarget = $state(0);

  function frameCamera(vrm: VRM) {
    const cam = camera.current as PerspectiveCamera | undefined;
    if (!cam) return;

    const headY =
      vrm.humanoid?.getNormalizedBoneNode("head")?.getWorldPosition(_v3a).y ?? null;
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

    const height = Math.max(0.1, top - bottom);
    const targetY = (headY ?? top) - height * 0.4;

    lastNaturalHeight = height;
    lastCameraTarget = targetY;
    applyCamera(height, targetY, 1);
  }

  function applyCamera(height: number, targetY: number, scale: number) {
    const cam = camera.current as PerspectiveCamera | undefined;
    if (!cam) return;

    const scaledHeight = height * scale;
    const scaledTarget = targetY * scale;
    const fovRad = (cam.fov * Math.PI) / 180;
    const distance = Math.max((scaledHeight / 2 / Math.tan(fovRad / 2)) * 1.6, 0.6);

    const dir = _v3e.set(cam.position.x, 0, cam.position.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();

    cam.position.set(dir.x * distance, scaledTarget + scaledHeight * 0.4, dir.z * distance);
    cam.lookAt(0, scaledTarget, 0);
    cam.updateProjectionMatrix();

    setCameraTarget([0, scaledTarget, 0]);
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
  const MIN_WIN_H = 600;
  const MIN_WIN_W = 300;
  const BASE_WIN_W = 540;
  const WIN_ASPECT = 3 / 4;

  function resizeWindowToVRM(_vrm: VRM, _naturalHeight: number) {
    const scale = appState.petScale;

    const w = Math.max(MIN_WIN_W, Math.min(1200, Math.round(BASE_WIN_W * scale)));
    const h = Math.max(MIN_WIN_H, Math.min(1800, Math.round(w / WIN_ASPECT)));

    getCurrentWindow()
      .setSize(new LogicalSize(w, h))
      .catch((err: unknown) => logger.warn("[VRM]", "setSize failed", err));
  }

  async function startLoad(idx: number) {
    if (idx === lastLoadedIdx) return;
    if (idx < 0 || idx >= appState.vrmList.length) return;
    lastLoadedIdx = idx;
    const meta = appState.vrmList[idx];
    const myToken = ++loadToken;

    const oldVrm = current;
    current = null;
    if (oldVrm) scene.remove(oldVrm.scene);
    disposeMixer(oldVrm);
    clipCache.clear();

    setStatus(STATUS.LOADING_VRM(meta.name));
    setLoading(true);
    modelLoading = true;

    try {
      const vrm = await loadVRM(meta.url);
      if (myToken !== loadToken) { disposeVRM(vrm); modelLoading = false; return; }
      if (oldVrm) disposeVRM(oldVrm);
      current = vrm;
      vrm.scene.visible = false;
      scene.add(vrm.scene);
      currentRev++;

      if (!appState.selectedAnim && appState.animList.length > 0) {
        setSelectedAnim(appState.animList[0].url);
      }

      await new Promise((r) => setTimeout(r, 0));
      if (myToken !== loadToken) return;
      vrm.scene.updateMatrixWorld(true);
      frameCamera(vrm);

      setStatus(STATUS.LOADED_VRM(meta.name));
      setLoading(false);
    } catch (e: unknown) {
      if (myToken !== loadToken) return;
      modelLoading = false;
      const msg = errorMessage(e);
      const stack = e instanceof Error ? e.stack : undefined;
      logger.error("[VRM]", `startLoad failed url=${meta.url} name=${meta.name} error=${msg}`, stack ?? "");
      setStatus(STATUS.VRM_LOAD_FAILED(meta.url, msg));
      setLoading(false);
      if (oldVrm) disposeVRM(oldVrm);
      lastLoadedIdx = -1;
    }
  }

  function nameToVrmIdx(name: string): number {
    return appState.vrmList.findIndex((v) => v.name === name);
  }

  // ---- Selected VRM -> debounced load + dispose ----
  $effect(() => {
    const name = appState.selectedVrm;
    if (appState.scanning) {
      setStatus(STATUS.SCANNING_VRM);
      return;
    }
    if (appState.vrmList.length === 0) {
      setStatus(STATUS.NO_VRMS);
      return;
    }
    const idx = nameToVrmIdx(name);
    if (idx < 0) return;
    if (idx === lastLoadedIdx) return;

    modelLoading = true;

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

        const newAction = mixer.clipAction(clip, vrm.scene);
        newAction.reset();
        // Ping-pong looping (forward then reverse) avoids the visible
        // snap-back to the VRMA's frame-0 bind pose that you'd see with
        // plain LoopRepeat: most looping motions (idle, walk, …) are
        // NOT seamless because frame 0 is the A-pose / T-pose, so a
        // hard cut at loop time is jarring. PingPong starts and ends
        // on the same pose, so the cycle boundary is invisible.
        newAction.setLoop(LoopPingPong, Infinity);
        newAction.enabled = true;
        newAction.paused = false;

        // Cross-fade from the currently-playing action (if any) to
        // the new one. `crossFadeTo` fades the source's weight to 0
        // and ramps the target's from 0 to 1 over the duration, then
        // auto-stops the source. This avoids the bind-pose flash that
        // a hard `stopAllAction() + play()` produces: with the old
        // code, both old and new actions were simultaneously at
        // weight 0 between `stopAllAction` and the new action's first
        // `update(dt)`, leaving the bones on the rig's rest pose for
        // a single frame.
        //
        // On the very first animation there is nothing to fade
        // from, so just play it directly.
        const oldAction = currentAction;
        currentAction = newAction;
        if (oldAction && oldAction !== newAction) {
          newAction.play();
          oldAction.crossFadeTo(newAction, ANIM_CROSSFADE_S, true);
        } else {
          newAction.play();
        }
        // Reveal the model now that the first action is playing.
        // Until this point the scene was hidden in startLoad() to
        // avoid flashing the bind pose.
        vrm.scene.visible = true;
        modelLoading = false;
        setStatus(STATUS.ANIM_PLAYING(name));
      })
      .catch((e: unknown) => {
        if (myAnimToken !== animToken) return;
        modelLoading = false;
        setStatus(STATUS.ANIM_ERROR(errorMessage(e)));
        logger.error("[VRM]", "animation load failed", e);
      });
  });

  // ---- Stop button -> stop the mixer ----
  $effect(() => {
    appState.stopToken;
    stopMixer();
    if (current) {
      current.scene.visible = true;
      modelLoading = false;
    }
  });

  $effect(() => {
    let s = appState.petScale;
    if (current && lastNaturalHeight > 0) {
      const rawW = Math.round(BASE_WIN_W * s);
      if (rawW < MIN_WIN_W) {
        s = MIN_WIN_W / BASE_WIN_W;
        appState.petScale = s;
      }
    }
    if (current) {
      current.scene.scale.setScalar(s);
    }
    if (current && lastNaturalHeight > 0) {
      applyCamera(lastNaturalHeight, lastCameraTarget, s);
      resizeWindowToVRM(current, lastNaturalHeight);
      appState.status = STATUS.ZOOM_PERCENT(Math.round(s * 100));
    }
  });

  // ---- Mouth movement (speaking / typing animation) ----
  $effect(() => {
    const w = appState.mouthWeight;
    if (!current?.expressionManager) return;
    current.expressionManager.setValue("aa", w);
    current.expressionManager.update();
  });

  // ---- MCP action: expression (BlendShape) ----
  $effect(() => {
    const expr = appState.pendingExpression;
    if (!expr || !current?.expressionManager) return;
    current.expressionManager.setValue(expr.name, expr.weight);
    current.expressionManager.update();
    appState.pendingExpression = null;
  });

  // ---- MCP action: bone pose ----
  $effect(() => {
    const pose = appState.pendingBonePose;
    if (!pose || !current?.humanoid) return;
    const bone = current.humanoid.getNormalizedBoneNode(pose.bone as VRMHumanBoneName);
    if (bone) {
      bone.rotation.x = pose.x;
      bone.rotation.y = pose.y;
      bone.rotation.z = pose.z;
    }
    appState.pendingBonePose = null;
  });

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
      disposeMixer(current);
      current = null;
    }
  });
</script>

{#if modelLoading}
  <div class="vrm-spinner" aria-hidden="true">
    <div class="spinner-ring"></div>
  </div>
{/if}

<style>
  .vrm-spinner {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 10;
  }
  .spinner-ring {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(255, 255, 255, 0.15);
    border-top-color: rgba(255, 255, 255, 0.85);
    border-radius: 50%;
    animation: vrm-spin 0.9s linear infinite;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }
  @keyframes vrm-spin {
    to { transform: rotate(360deg); }
  }
</style>