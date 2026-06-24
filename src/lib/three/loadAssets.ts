import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AssetEntry } from "$lib/stores.svelte";

/**
 * Ask the Rust side to scan `$RESOURCE/assets/` and return all
 * `.vrm` and `.vrma` files. Throws when called outside the Tauri
 * WebView (e.g. plain `pnpm dev` in a browser tab) — the caller is
 * expected to catch and show a friendly message.
 */
export async function listAssets(): Promise<AssetEntry[]> {
  if (!isTauri()) {
    throw new Error(
      "Asset listing requires the Tauri runtime. Run `pnpm tauri dev` instead of `pnpm dev`.",
    );
  }
  return await invoke<AssetEntry[]>("list_assets");
}