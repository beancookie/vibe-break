<script lang="ts">
  import { onMount } from "svelte";
  import { appState } from "$lib/stores.svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  // Menu state. x/y are viewport coordinates in CSS pixels.
  let open = $state(false);
  let x = $state(0);
  let y = $state(0);
  let pinned = $state(false);

  async function show(e: MouseEvent) {
    e.preventDefault();
    // Sync the pinned state from the actual window (in case it was
    // changed elsewhere).
    try {
      pinned = await getCurrentWindow().isAlwaysOnTop();
    } catch {
      pinned = false;
    }
    // Clamp to viewport so the menu never opens off-screen.
    const pad = 8;
    x = Math.min(e.clientX, window.innerWidth - 240 - pad);
    y = Math.min(e.clientY, window.innerHeight - 320 - pad);
    open = true;
  }

  function close() {
    open = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  function onDocClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest(".ctx-menu")) return; // click inside menu
    close();
  }

  function replayAnim() {
    const url = appState.selectedAnim;
    if (!url) return;
    appState.selectedAnim = "";
    queueMicrotask(() => {
      appState.selectedAnim = url;
    });
    close();
  }

  function stopAnim() {
    appState.selectedAnim = "";
    appState.stopToken++;
    close();
  }

  async function togglePin() {
    const w = getCurrentWindow();
    const next = !pinned;
    await w.setAlwaysOnTop(next);
    pinned = next;
    close();
  }

  onMount(() => {
    document.addEventListener("contextmenu", show);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", show);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

{#if open}
  <div
    class="ctx-menu"
    role="menu"
    tabindex="-1"
    style="left: {x}px; top: {y}px"
    oncontextmenu={(e) => e.preventDefault()}
  >
    <div class="ctx-header">Vibe Break</div>

    <label class="ctx-row">
      <span>Model</span>
      <select
        bind:value={appState.selectedVrm}
        disabled={appState.vrmList.length === 0 || appState.isLoading}
        onclick={(e) => e.stopPropagation()}
      >
        {#if appState.scanning}
          <option>scanning…</option>
        {:else if appState.vrmList.length === 0}
          <option>(no .vrm found)</option>
        {:else}
          {#each appState.vrmList as v, i (v.url)}
            <option value={i}>{v.name}</option>
          {/each}
        {/if}
      </select>
    </label>

    <label class="ctx-row">
      <span>Animation</span>
      <select
        bind:value={appState.selectedAnim}
        disabled={appState.animList.length === 0}
        onclick={(e) => e.stopPropagation()}
      >
        <option value="">— pick —</option>
        {#each appState.animList as a (a.url)}
          <option value={a.url}>{a.name}</option>
        {/each}
      </select>
    </label>

    <div class="ctx-sep"></div>

    <button
      class="ctx-btn"
      disabled={!appState.selectedAnim || appState.isLoading}
      onclick={replayAnim}
    >▶ Replay animation</button>

    <button class="ctx-btn" onclick={stopAnim}>■ Stop animation</button>

    <div class="ctx-sep"></div>

    <button class="ctx-btn" onclick={togglePin}>
      {pinned ? "✓" : "　"} Always on top
    </button>

    <div class="ctx-status">{appState.status}</div>
  </div>
{/if}

<style>
  .ctx-menu {
    position: fixed;
    z-index: 1000;
    min-width: 220px;
    background: rgba(20, 20, 20, 0.92);
    color: #eee;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 6px 0;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui,
      sans-serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    user-select: none;
    backdrop-filter: blur(6px);
  }

  .ctx-header {
    padding: 4px 12px 6px;
    font-weight: 600;
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .ctx-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
  }

  .ctx-row span {
    width: 60px;
    font-size: 11px;
    opacity: 0.85;
  }

  .ctx-row select {
    flex: 1;
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 11px;
    font-family: inherit;
  }

  .ctx-sep {
    height: 1px;
    background: #333;
    margin: 4px 0;
  }

  .ctx-btn {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    color: #eee;
    border: none;
    padding: 5px 12px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
  }

  .ctx-btn:hover:not(:disabled) {
    background: rgba(74, 127, 190, 0.3);
  }

  .ctx-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ctx-status {
    padding: 4px 12px 2px;
    font-size: 10px;
    color: #777;
    font-style: italic;
  }
</style>