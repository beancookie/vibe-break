import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { resourceDir, join } from "@tauri-apps/api/path";

export async function assetUrl(url: string): Promise<string> {
  if (isTauri()) {
    const resDir = await resourceDir();
    const abs: string = await join(resDir, "resources", url);
    const posix = abs.split("\\").join("/");
    return convertFileSrc(posix);
  }
  return "/" + url;
}
