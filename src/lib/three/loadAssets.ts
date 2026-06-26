import { isTauri, invoke } from "@tauri-apps/api/core";
import { NotTauriError } from "$lib/errors";
import type { AssetEntry } from "$lib/stores.svelte";

export async function listAssets(): Promise<AssetEntry[]> {
  if (!isTauri()) {
    throw new NotTauriError();
  }
  return await invoke<AssetEntry[]>("list_assets");
}