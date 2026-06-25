import { isTauri, invoke, convertFileSrc } from "@tauri-apps/api/core";
import { ERROR } from "$lib/strings";

export class AssetListError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AssetListError";
  }
}

export class NotTauriError extends AssetListError {
  constructor() {
    super(ERROR.NOT_TAURI);
    this.name = "NotTauriError";
  }
}

export { isTauri, invoke, convertFileSrc };
