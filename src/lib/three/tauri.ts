/**
 * Whether the current runtime is the Tauri WebView. We re-export
 * the official `isTauri()` from @tauri-apps/api/core so the check
 * stays in sync with the one used internally by `invoke()`.
 */
export { isTauri } from "@tauri-apps/api/core";
