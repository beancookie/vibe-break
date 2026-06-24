import { Object3D } from "three";

export type AssetEntry = { name: string; url: string };

export const appState = $state({
  selectedVrm: 0,
  selectedAnim: "",
  /** Increments every time the user presses stop. VrmModel watches this
   *  to call mixer.stopAllAction() - declaring imperative side effects
   *  as a reaction to state changes. */
  stopToken: 0,
  /** World-space target that OrbitControls should look at. Updated by
   *  VrmModel after each model load so the camera frames the new model. */
  cameraTarget: [0, 1.2, 0] as [number, number, number],
  status: "Initializing...",
  isLoading: false,
  /** Models (.vrm) found on disk under resources/assets/. */
  vrmList: [] as AssetEntry[],
  /** Animations (.vrma) found on disk under resources/assets/vrma/. */
  animList: [] as AssetEntry[],
  /** True while the initial asset scan is running. */
  scanning: true,
  /** User-controlled scale of the pet (1.0 = natural size). The wheel
   *  changes this; the model and the window both react. */
  petScale: 1.0,
});

/**
 * Shared world-space Object3D that VRM models look at (head/eye tracking).
 * CameraRig updates its position based on the mouse; VrmModel assigns it
 * to `vrm.lookAt.target` so the model follows.
 *
 * Kept as a module-level singleton rather than appState because THREE
 * objects should never be wrapped in $state proxies.
 */
export const lookTarget = new Object3D();
lookTarget.position.set(0, 1.2, 0);