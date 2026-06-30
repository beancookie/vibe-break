import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM, VRMUtils } from "@pixiv/three-vrm";
import {
  VRMAnimation,
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";
import * as THREE from "three";
import { readAssetBuffer } from "./assetUrl";
import { logger } from "$lib/logger";

let vrmLoader: GLTFLoader | null = null;
const getVrmLoader = () =>
  (vrmLoader ??= new GLTFLoader().register((p) => new VRMLoaderPlugin(p)));

let vrmaLoader: GLTFLoader | null = null;
const getVrmaLoader = () =>
  (vrmaLoader ??= new GLTFLoader().register(
    (p) => new VRMAnimationLoaderPlugin(p),
  ));

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  logger.info("[VRM]", `fetchBuffer url=${url}`);
  const buf = await readAssetBuffer(url);
  logger.debug("[VRM]", `fetchBuffer done size=${buf.byteLength}`);
  return buf;
}

function parseVRMBuffer(buffer: ArrayBuffer): Promise<VRM> {
  logger.debug("[VRM]", "parseVRMBuffer start");
  return new Promise<VRM>((resolve, reject) => {
    try {
      getVrmLoader().parse(
        buffer,
        "",
        (gltf) => {
          const vrm = gltf.userData.vrm as VRM | undefined;
          if (!vrm) {
            const msg = "No VRM in gltf.userData";
            logger.error("[VRM]", `parseVRMBuffer failed: ${msg}`);
            reject(new Error(msg));
            return;
          }
          VRMUtils.rotateVRM0(vrm);
          logger.debug("[VRM]", "parseVRMBuffer done");
          resolve(vrm);
        },
        (err) => {
          logger.error("[VRM]", "parseVRMBuffer GLTF error", err);
          reject(err);
        },
      );
    } catch (e) {
      logger.error("[VRM]", "parseVRMBuffer exception", e);
      reject(e as Error);
    }
  });
}

export async function loadVRM(url: string): Promise<VRM> {
  logger.info("[VRM]", `loadVRM start url=${url}`);
  const buffer = await fetchBuffer(url);
  await yieldToMain();
  const vrm = await parseVRMBuffer(buffer);
  await yieldToMain();
  logger.info("[VRM]", `loadVRM done url=${url}`);
  return vrm;
}

export function disposeVRM(vrm: VRM | null | undefined): void {
  if (!vrm) return;
  const scene = vrm.scene;
  if (scene.parent) scene.parent.remove(scene);
  setTimeout(() => {
    try {
      VRMUtils.deepDispose(scene);
    } catch (err) {
      logger.warn("[VRM]", "disposeVRM failed", err);
    }
  }, 0);
}

export async function loadVRMAClip(
  url: string,
  vrm: VRM,
): Promise<THREE.AnimationClip> {
  logger.info("[VRM]", `loadVRMAClip start url=${url}`);
  const buffer = await fetchBuffer(url);
  await yieldToMain();
  const clip = await new Promise<THREE.AnimationClip>((resolve, reject) => {
    try {
      getVrmaLoader().parse(
        buffer,
        "",
        (gltf) => {
          const arr = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;
          if (!arr || arr.length === 0) {
            const msg = `No VRMAnimation in ${url}`;
            logger.error("[VRM]", `loadVRMAClip failed: ${msg}`);
            reject(new Error(msg));
            return;
          }
          logger.debug("[VRM]", `loadVRMAClip parsed, creating clip`);
          resolve(createVRMAnimationClip(arr[0], vrm as any));
        },
        (err) => {
          logger.error("[VRM]", "loadVRMAClip GLTF error", err);
          reject(err);
        },
      );
    } catch (e) {
      logger.error("[VRM]", "loadVRMAClip exception", e);
      reject(e as Error);
    }
  });
  logger.info("[VRM]", `loadVRMAClip done url=${url}`);
  return clip;
}
