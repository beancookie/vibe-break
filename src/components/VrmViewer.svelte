<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import { VRMLoaderPlugin, VRM, VRMUtils } from "@pixiv/three-vrm";
  import {
    VRMAnimation,
    VRMAnimationLoaderPlugin,
    createVRMAnimationClip,
  } from "@pixiv/three-vrm-animation";
  import type { VRMExpressionPresetName } from "@pixiv/three-vrm";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { resolveResource } from "@tauri-apps/api/path";

  // ----- VRM / VRMA lists (edit to add or change models / animations) -----
  const VRMS: { name: string; url: string }[] = [
    { name: "芙宁娜", url: "assets/芙宁娜.vrm" },
    { name: "Klee", url: "assets/Klee.vrm" },
  ];

  const ANIMATIONS: { name: string; url: string }[] = [
    { name: "Angry", url: "assets/vrma/Angry.vrma" },
    { name: "Blush", url: "assets/vrma/Blush.vrma" },
    { name: "Clapping", url: "assets/vrma/Clapping.vrma" },
    { name: "Goodbye", url: "assets/vrma/Goodbye.vrma" },
    { name: "Jump", url: "assets/vrma/Jump.vrma" },
    { name: "LookAround", url: "assets/vrma/LookAround.vrma" },
    { name: "Relax", url: "assets/vrma/Relax.vrma" },
    { name: "Sad", url: "assets/vrma/Sad.vrma" },
    { name: "Sleepy", url: "assets/vrma/Sleepy.vrma" },
    { name: "Surprised", url: "assets/vrma/Surprised.vrma" },
    { name: "Thinking", url: "assets/vrma/Thinking.vrma" },
  ];

  const VRM_EXPRESSIONS: VRMExpressionPresetName[] = [
    "happy", "angry", "sad", "relaxed", "surprised", "neutral",
    "blink", "blinkLeft", "blinkRight",
    "aa", "ih", "ou", "ee", "oh",
  ];

  // In Tauri the WebView can't `fetch()` relative paths directly. We resolve
  // the resource path (declared in `tauri.conf.json` → `bundle.resources`)
  // to an absolute path on disk, then convert it to a `tauri://` URL.
  const tauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  async function assetUrl(url: string): Promise<string> {
    if (tauri) {
      const abs = await resolveResource(url);
      return convertFileSrc(abs);
    }
    return "/" + url;
  }

  // ----- Refs to DOM and runtime state -----
  let canvasEl: HTMLCanvasElement;
  let status = $state("Initializing…");

  // Non-reactive THREE objects (kept out of $state to avoid deep proxy
  // wrapping, which would be slow and break THREE's internal expectations).
  let currentVRM: VRM | null = null;
  let currentMixer: THREE.AnimationMixer | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let controls: OrbitControls | null = null;
  let lookTarget: THREE.Object3D | null = null;
  let mouseScreen = new THREE.Vector2(0, 0);
  const animCache = new Map<string, Promise<THREE.AnimationClip>>();

  let raf = 0;
  const clock = new THREE.Clock();

  // ----- UI state -----
  let selectedVrmIdx = $state(0);
  let selectedAnimUrl = $state<string>("");
  const animSelectDisabled = ANIMATIONS.length === 0;

  // ----- Expression sliders: only build them for the current model's manager -----
  type ExprRow = { name: VRMExpressionPresetName; value: number };
  let exprRows = $state<ExprRow[]>([]);

  // ----- Load helpers -----
  async function loadVRM(url: string): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((p) => new VRMLoaderPlugin(p));
    const gltf = await loader.loadAsync(await assetUrl(url));
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error(`No VRM in ${url}`);
    VRMUtils.rotateVRM0(vrm);
    return vrm;
  }

  async function loadVRMA(url: string): Promise<VRMAnimation> {
    const loader = new GLTFLoader();
    loader.register((p) => new VRMAnimationLoaderPlugin(p));
    const gltf = await loader.loadAsync(await assetUrl(url));
    const arr = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;
    if (!arr || arr.length === 0) throw new Error(`No VRMAnimation in ${url}`);
    return arr[0];
  }

  async function getClip(url: string, vrm: VRM): Promise<THREE.AnimationClip> {
    const cached = animCache.get(url);
    if (cached) return cached;
    const p = loadVRMA(url).then((a) => createVRMAnimationClip(a, vrm as any));
    animCache.set(url, p);
    return p;
  }

  // ----- VRM load / swap -----
  async function setVRM(idx: number): Promise<void> {
    if (!scene) return;
    selectedVrmIdx = idx;
    const { url, name } = VRMS[idx];
    status = `Loading ${name}…`;
    try {
      if (currentVRM) {
        scene.remove(currentVRM.scene);
        VRMUtils.deepDispose(currentVRM.scene);
        currentVRM = null;
      }
      currentMixer?.stopAllAction();
      currentMixer = null;
      animCache.clear();

      const vrm = await loadVRM(url);
      currentVRM = vrm;
      scene.add(vrm.scene);

      // Rebuild expression rows for the new model (only ones the model defines).
      const em = vrm.expressionManager;
      if (em) {
        exprRows = VRM_EXPRESSIONS
          .filter((n) => em.getExpression(n))
          .map((n) => ({ name: n, value: 0 }));
      } else {
        exprRows = [];
      }

      status = "Loaded — drag to rotate, scroll to zoom";
    } catch (err) {
      status = `Error: ${(err as Error).message}`;
      console.error(err);
    }
  }

  function setExpression(name: VRMExpressionPresetName, value: number): void {
    currentVRM?.expressionManager?.setValue(name, value);
  }

  function resetExpressions(): void {
    for (const r of exprRows) r.value = 0;
    const em = currentVRM?.expressionManager;
    if (em) {
      for (const r of exprRows) em.setValue(r.name, 0);
    }
  }

  // ----- Playback -----
  function playSelectedAnimation(): void {
    if (!currentVRM || !selectedAnimUrl) return;
    const vrm = currentVRM;
    const url = selectedAnimUrl;
    const name = ANIMATIONS.find((a) => a.url === url)?.name ?? "?";
    void (async () => {
      try {
        const clip = await getClip(url, vrm);
        if (!currentVRM) return;
        if (!currentMixer) currentMixer = new THREE.AnimationMixer(vrm.scene);
        const action = currentMixer.clipAction(clip, vrm.scene);
        action.reset();
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        status = `▶ ${name}`;
      } catch (err) {
        status = `Anim error: ${(err as Error).message}`;
        console.error(err);
      }
    })();
  }

  function stopAnimations(): void {
    currentMixer?.stopAllAction();
    status = currentVRM ? "Loaded" : "Idle";
  }

  // ----- Animation loop -----
  function tick(): void {
    raf = requestAnimationFrame(tick);
    const dt = clock.getDelta();
    currentVRM?.update(dt);
    currentMixer?.update(dt);

    if (currentVRM?.lookAt && lookTarget && camera) {
      const ndc = new THREE.Vector3(mouseScreen.x, mouseScreen.y, 0.5);
      ndc.unproject(camera);
      const dir = ndc.sub(camera.position).normalize();
      lookTarget.position.copy(camera.position).addScaledVector(dir, 2.0);
      lookTarget.position.y = Math.max(0.5, Math.min(2.0, lookTarget.position.y));
      currentVRM.lookAt.target = lookTarget;
    }

    controls?.update();
    renderer?.render(scene!, camera!);
  }

  function onMouseMove(e: MouseEvent): void {
    mouseScreen.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseScreen.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function onResize(): void {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  // ----- Lifecycle -----
  onMount(() => {
    if (!canvasEl) return;

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.4, 3.0);
    camera.lookAt(0, 1.2, 0);

    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(1, 2, 1.5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-1, 0.5, -1);
    scene.add(fill);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    controls = new OrbitControls(camera, canvasEl);
    controls.target.set(0, 1.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    lookTarget = new THREE.Object3D();
    lookTarget.position.set(0, 1.2, 0);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    tick();
    void setVRM(0);
  });

  onDestroy(() => {
    cancelAnimationFrame(raf);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("resize", onResize);
    if (currentVRM) VRMUtils.deepDispose(currentVRM.scene);
    currentMixer = null;
    renderer?.dispose();
    renderer = null;
    scene = null;
    camera = null;
    controls = null;
  });

  function onVrmSelect(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    void setVRM(target.selectedIndex);
  }

  function onExprInput(row: ExprRow, e: Event) {
    setExpression(row.name, parseFloat((e.currentTarget as HTMLInputElement).value));
  }
</script>

<canvas bind:this={canvasEl}></canvas>

<div class="ui-top">
  <label>
    VRM:
    <select value={selectedVrmIdx} onchange={onVrmSelect}>
      {#each VRMS as v, i (v.url)}
        <option value={i}>{v.name}</option>
      {/each}
    </select>
  </label>
  <label>
    Animation:
    <select bind:value={selectedAnimUrl} disabled={animSelectDisabled}>
      <option value="">— pick animation —</option>
      {#each ANIMATIONS as a (a.url)}
        <option value={a.url}>{a.name}</option>
      {/each}
    </select>
  </label>
  <button disabled={!selectedAnimUrl} onclick={playSelectedAnimation}>▶ play</button>
  <button onclick={stopAnimations}>■ stop</button>
  <span class="status">{status}</span>
</div>

<div class="ui-right">
  <h3>Expressions</h3>
  {#each exprRows as row (row.name)}
    <label class="expr-row">
      <span>{row.name}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={row.value}
        oninput={(e) => onExprInput(row, e)}
      />
    </label>
  {/each}
  {#if exprRows.length}
    <button class="expr-reset" onclick={resetExpressions}>reset expressions</button>
  {/if}
</div>

<style>
  canvas {
    display: block;
    width: 100vw;
    height: 100vh;
  }

  .ui-top {
    position: fixed;
    top: 12px;
    left: 12px;
    background: rgba(0, 0, 0, 0.55);
    padding: 8px 12px;
    border-radius: 6px;
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 14px;
    z-index: 10;
    user-select: none;
    color: #eee;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }

  .ui-top label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ui-top select,
  .ui-top button {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 13px;
  }

  .ui-top button {
    cursor: pointer;
  }

  .ui-top button:hover:not(:disabled) {
    background: #3a3a3a;
  }

  .ui-top button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .status {
    opacity: 0.7;
    font-size: 12px;
    margin-left: auto;
  }

  .ui-right {
    position: fixed;
    top: 60px;
    right: 12px;
    width: 220px;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.55);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 10;
    user-select: none;
    color: #eee;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }

  .ui-right h3 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 600;
    opacity: 0.9;
  }

  .expr-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .expr-row span {
    width: 80px;
    font-size: 11px;
    opacity: 0.85;
  }

  .expr-row input[type="range"] {
    flex: 1;
    cursor: pointer;
    accent-color: #4a7fbe;
  }

  .expr-reset {
    margin-top: 8px;
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    width: 100%;
  }

  .expr-reset:hover {
    background: #3a3a3a;
  }
</style>
