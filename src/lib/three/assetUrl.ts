import { isTauri } from "@tauri-apps/api/core";
import { resourceDir, join } from "@tauri-apps/api/path";
import { readFile } from "@tauri-apps/plugin-fs";

export async function readAssetBuffer(url: string): Promise<ArrayBuffer> {
  if (isTauri()) {
    const resDir = await resourceDir();
    const abs = await join(resDir, "resources", url);
    const data = await readFile(abs);
    return data.buffer;
  }
  const res = await fetch("/" + url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.arrayBuffer();
}
