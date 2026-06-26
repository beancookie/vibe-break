import { logger } from "$lib/logger";

const DRAG_THRESHOLD_PX = 4;
const LONG_PRESS_MS = 150;

export function createWindowDrag() {
  let dragging = false;
  let downX = 0;
  let downY = 0;
  let pressTimer: number | null = null;

  async function beginDrag() {
    if (dragging) return;
    dragging = true;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch (err) {
      logger.warn("[UI]", "startDragging failed", err);
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    downX = e.clientX;
    downY = e.clientY;
    dragging = false;
    pressTimer = window.setTimeout(beginDrag, LONG_PRESS_MS);
  }

  function onMouseUp() {
    if (pressTimer !== null) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    dragging = false;
  }

  function onMove(e: MouseEvent) {
    if (pressTimer !== null || dragging) {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        if (pressTimer !== null) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        void beginDrag();
      }
    }
  }

  function destroy() {
    if (pressTimer !== null) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    dragging = false;
  }

  return { onMouseDown, onMouseUp, onMove, destroy };
}
