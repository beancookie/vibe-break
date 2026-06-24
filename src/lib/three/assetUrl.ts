import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { resourceDir, join } from "@tauri-apps/api/path";

/**
 * In the Tauri WebView the asset:// protocol is used; in a plain
 * browser we fall back to a leading-slash public path.
 *
 * Why we do NOT use `resolveResource`:
 *
 *   Tauri 2's `resolveResource("assets/Klee.vrm")` returns
 *   `<resource_dir>/assets/Klee.vrm`, where `resource_dir()` on
 *   Windows is the directory containing the .exe (e.g.
 *   `target\debug\`). But the bundled resources live in
 *   `target\debug\resources\assets\...` - one level DEEPER, inside
 *   a `resources/` subdirectory. So `resolveResource` points at the
 *   wrong location and the request 404s.
 *
 * The actual on-disk layout is always
 *   <exe-dir>/resources/<our-relative-url>
 * so we build the path ourselves.
 */
export async function assetUrl(url: string): Promise<string> {
  if (isTauri()) {
    const resDir = await resourceDir();
    // resDir = <exe-dir>; resources live at <exe-dir>/resources/<url>
    const abs: string = await join(resDir, "resources", url);
    // Normalise backslashes to forward slashes so the asset:// scope
    // glob (POSIX-style) can match.
    const posix = abs.split("\\").join("/");
    return convertFileSrc(posix);
  }
  return "/" + url;
}