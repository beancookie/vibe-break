import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM, VRMUtils } from "@pixiv/three-vrm";
import {
  VRMAnimation,
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";
import * as THREE from "three";
import { assetUrl } from "./assetUrl";

// Singleton GLTFLoaders so we don't re-instantiate per load.
let vrmLoader: GLTFLoader | null = null;
const getVrmLoader = () =>
  (vrmLoader ??= new GLTFLoader().register((p) => new VRMLoaderPlugin(p)));

let vrmaLoader: GLTFLoader | null = null;
const getVrmaLoader = () =>
  (vrmaLoader ??= new GLTFLoader().register(
    (p) => new VRMAnimationLoaderPlugin(p),
  ));

// ---------------------------------------------------------------------------
// Why we split the load into "fetch buffer" + "parse buffer" instead of
// loadAsync() directly:
//   1. `loadAsync()` does both the network round-trip AND the synchronous
//      GLB parse on the same microtask. For a 40+ MB VRM model the parse
//      alone can take 1–3 seconds of main-thread time, during which the
//      WebView is completely frozen.
//   2. By splitting the two steps we can `await yieldToMain()` between
//      them and again after the parse, so the browser gets a chance to
//      repaint "Loading…" status and the window stays responsive.
//   3. The previous code also never freed textures before re-adding a new
//      model, and the synchronous `VRMUtils.deepDispose()` for a complex
//      model (skinned meshes, mtoon, expressions) blocks the main thread
//      for a further 100–500 ms. `disposeVRM` schedules that work on a
//      later task instead.
// ---------------------------------------------------------------------------

/**
 * Yield to the browser so it can paint / process input. One `setTimeout`
 * tick is the cheapest way to do this from user code.
 */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Fetch a file as an `ArrayBuffer`. Uses `fetch` against the `asset://`
 * URL (or browser fallback) so the read happens on Tauri's IO thread,
 * not on the renderer main thread.
 */
async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const finalUrl = await assetUrl(url);
  const res = await fetch(finalUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${finalUrl}`);
  return await res.arrayBuffer();
}

/**
 * Parse a previously-fetched VRM `ArrayBuffer` into a `VRM` instance.
 * Pure CPU work wrapped in a Promise so it composes with the surrounding
 * `await` / `yieldToMain` chain.
 */
function parseVRMBuffer(buffer: ArrayBuffer): Promise<VRM> {
  return new Promise<VRM>((resolve, reject) => {
    try {
      getVrmLoader().parse(
        buffer,
        "",
        (gltf) => {
          const vrm = gltf.userData.vrm as VRM | undefined;
          if (!vrm) {
            reject(new Error("No VRM in gltf.userData"));
            return;
          }
          VRMUtils.rotateVRM0(vrm);
          resolve(vrm);
        },
        (err) => reject(err),
      );
    } catch (e) {
      reject(e as Error);
    }
  });
}

/**
 * Full pipeline: fetch -> parse -> yield so the UI can repaint.
 *
 * Yields to the main thread between phases so the WebView can update the
 * "Loading…" status and process window/UI events.
 */
export async function loadVRM(url: string): Promise<VRM> {
  // Phase 1: fetch. Network I/O is async, doesn't block the main thread
  // but we still yield afterwards so the "Loading..." status can paint.
  const buffer = await fetchBuffer(url);
  await yieldToMain();

  // Phase 2: parse. This is the heavy part (1–3 s for a 40 MB VRM on a
  // mid-range laptop). Yield afterwards so the success-status text has
  // a chance to render before the camera-fit effect runs.
  const vrm = await parseVRMBuffer(buffer);
  await yieldToMain();

  return vrm;
}

/**
 * Lightweight VRM dispose. `VRMUtils.deepDispose()` walks the whole
 * scene graph and calls `dispose()` on every geometry, material, and
 * texture; for a complex model that can be 100–500 ms of synchronous
 * work and freeze the WebView.
 *
 * The common case is "I'm replacing the current model with a new one,
 * start the dispose but don't block this frame." `disposeVRM` defers
 * the actual teardown to a later task via `setTimeout(0)`. The old
 * scene is removed from the parent first so it stops rendering.
 */
export function disposeVRM(vrm: VRM | null | undefined): void {
  if (!vrm) return;
  const scene = vrm.scene;
  if (scene.parent) scene.parent.remove(scene);
  setTimeout(() => {
    try {
      VRMUtils.deepDispose(scene);
    } catch (err) {
      console.warn("disposeVRM failed:", err);
    }
  }, 0);
}

export async function loadVRMAClip(
  url: string,
  vrm: VRM,
): Promise<THREE.AnimationClip> {
  const buffer = await fetchBuffer(url);
  await yieldToMain();
  return await new Promise<THREE.AnimationClip>((resolve, reject) => {
    try {
      getVrmaLoader().parse(
        buffer,
        "",
        (gltf) => {
          const arr = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;
          if (!arr || arr.length === 0) {
            reject(new Error(`No VRMAnimation in ${url}`));
            return;
          }
          resolve(createVRMAnimationClip(arr[0], vrm as any));
        },
        (err) => reject(err),
      );
    } catch (e) {
      reject(e as Error);
    }
  });
}