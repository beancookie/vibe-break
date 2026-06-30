<script lang="ts">
  import { onMount } from "svelte";
  import { appState, resetCounters, type AiState } from "$lib/stores.svelte";
  import { UI, STATUS } from "$lib/strings";
  import { getSupportedLocales } from "$lib/i18n.svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Button from "$lib/components/ui/button.svelte";
  import Separator from "$lib/components/ui/separator.svelte";
  import Label from "$lib/components/ui/label.svelte";
  import { logger } from "$lib/logger";

  const STATE_COLORS: Record<AiState, string> = {
    idle: "#4ade80",
    thinking: "#fbbf24",
    done: "#60a5fa",
    error: "#f87171",
  };

  // Menu state. Position is fixed (top-right corner of the window),
  // so we don't track x/y here - the CSS handles it.
  let open = $state(false);
  let pinned = $state(false);

  // Thinking timer
  let thinkingElapsed = $state("00:00");
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      if (!appState.thinkingStart) return;
      const elapsed = Math.floor((Date.now() - appState.thinkingStart) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const s = String(elapsed % 60).padStart(2, "0");
      thinkingElapsed = `${m}:${s}`;
    }, 200);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    thinkingElapsed = "00:00";
  }

  $effect(() => {
    if (open && appState.aiState === "thinking") {
      startTimer();
    } else {
      stopTimer();
    }
  })

  /**
   * Open the menu and refresh the always-on-top indicator. The menu
   * itself is anchored via CSS (top-right of the window), so this
   * function only needs to flip `open` and read the current pin
   * state from the OS window.
   */
  async function show() {
    try {
      pinned = await getCurrentWindow().isAlwaysOnTop();
    } catch (e) {
      logger.warn("[UI]", "isAlwaysOnTop check failed", e);
      pinned = false;
    }
    open = true;
  }

  function close() {
    open = false;
  }

  function toggle() {
    if (open) {
      close();
    } else {
      void show();
    }
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    toggle();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  // ---- Double-click + single-click close detection ----
  // We listen to `mouseup` on the document in capture phase so we
  // run before any window-level listeners. Tauri 2's WebView2
  // transparent window drops the native `dblclick` event when the
  // OS captures the pointer for window-dragging, so we synthesise
  // double-click detection from the mouseup stream.
  //
  // The key insight is that the two gestures are *not* independent:
  // the first tap of a double-click must not also count as a single
  // click. We implement this with a tiny state machine instead of
  // a parallel "single click + double click" check.
  //
  // Rules (applied in order):
  //   1. Click inside the menu       -> reset state, no menu change.
  //   2. First tap of a pair         -> record it, close menu if open
  //                                     (a single click outside the
  //                                     menu closes it; we still
  //                                     remember the tap so a second
  //                                     tap can be recognised as a
  //                                     double-click).
  //   3. Second tap of a pair (DBLC) -> open the menu at this
  //                                     position. (If the menu was
  //                                     open, Rule 2 already closed
  //                                     it on the first tap; we just
  //                                     re-open it here so the
  //                                     double-click looks like a
  //                                     "blink shut and re-open at
  //                                     the new spot". If the menu
  //                                     was closed, Rule 2 didn't
  //                                     touch it and we open it now.)
  //   4. Right-click anywhere         -> toggle (handled above).
  const DBLCLICK_MS = 350;
  const DBLCLICK_PX = 10;
  // First-tap record: 0 means no pending first tap. We compare
  // against the *time* of the first tap to decide whether a
  // subsequent tap is a double-click.
  let firstTap = { t: 0, x: 0, y: 0 };

  function onDocMouseUpCapture(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;

    // Rule 1: click inside the menu -> reset, don't act.
    if (target?.closest("[data-ctx-menu]")) {
      firstTap = { t: 0, x: 0, y: 0 };
      return;
    }

    const now = performance.now();
    const dx = e.clientX - firstTap.x;
    const dy = e.clientY - firstTap.y;
    const isSecondTap =
      firstTap.t !== 0 &&
      now - firstTap.t < DBLCLICK_MS &&
      dx * dx + dy * dy < DBLCLICK_PX * DBLCLICK_PX;

    if (isSecondTap) {
      // Rule 3: double-click second tap -> open the menu. The menu
      // is anchored top-right by CSS, so we don't pass cursor
      // coordinates.
      firstTap = { t: 0, x: 0, y: 0 };
      if (!open) void show();
      return;
    }

    // Rule 2: first tap (or a tap that arrived too late / too far
    // to be the second of a double-click). Close the menu if it's
    // currently open - the user clicked outside it. Remember the
    // tap only if the menu was already closed, so a closing tap
    // doesn't trigger a spurious double-click on the next tap.
    if (open) {
      close();
      firstTap = { t: 0, x: 0, y: 0 };
    } else {
      firstTap = { t: now, x: e.clientX, y: e.clientY };
    }
  }

  async function togglePin() {
    const w = getCurrentWindow();
    const next = !pinned;
    await w.setAlwaysOnTop(next);
    pinned = next;
    appState.alwaysOnTop = next;
    close();
  }

  let currentLocale = $derived(appState.locale);
  let locales = $derived(getSupportedLocales());

  let displayStateLabel = $derived.by(() => {
    switch (appState.aiState) {
      case "idle": return STATUS.IDLE;
      case "thinking": return "Thinking";
      case "done": return "Done";
      case "error": return "Error";
    }
  });

  function toggleLocale() {
    appState.locale = currentLocale;
  }

  onMount(() => {
    // `capture: true` makes us run on the way down the DOM tree, ahead
    // of CameraRig's window-bubble mouseup handler. That guarantees
    // we see the mouseup even if a later listener calls
    // stopPropagation (we don't need to, but it's belt-and-braces
    // given the flaky double-click behaviour in Tauri WebView2).
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("mouseup", onDocMouseUpCapture, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("mouseup", onDocMouseUpCapture, true);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

{#if open}
  <div
    data-ctx-menu
    role="menu"
    tabindex="-1"
    class="bg-popover/90 text-popover-foreground border-border/60 ring-1 ring-black/5 supports-[backdrop-filter]:bg-popover/75 supports-[backdrop-filter]:backdrop-blur-md fixed top-3 right-3 z-50 w-[12rem] rounded-lg border p-1.5 shadow-2xl select-none"
    oncontextmenu={(e) => e.preventDefault()}
  >
    <!-- Header -->
    <div
      class="text-muted-foreground px-2 pb-1.5 pt-1 text-xs font-semibold tracking-wider uppercase flex items-center justify-between"
    >
      <span>{UI.MENU_HEADER}</span>
      <select
        bind:value={currentLocale}
        onclick={(e) => e.stopPropagation()}
        onchange={toggleLocale}
        class="border-input bg-background text-foreground h-5 w-20 rounded border px-1 text-[10px] shadow-sm focus:ring-1 focus:outline-none"
      >
        {#each locales as l (l.value)}
          <option value={l.value}>{l.label}</option>
        {/each}
      </select>
    </div>

    <!-- Model picker -->
    <div class="flex items-center gap-2 px-2 py-1">
      <Label class="text-muted-foreground w-10 text-xs font-normal">
        {UI.LABEL_MODEL}
      </Label>
      <select
        bind:value={appState.selectedVrm}
        disabled={appState.vrmList.length === 0 || appState.isLoading}
        onclick={(e) => e.stopPropagation()}
        onchange={close}
        class="border-input bg-background text-foreground focus:ring-ring ring-offset-background placeholder:text-muted-foreground h-7 w-full rounded-md border px-2 text-xs shadow-sm focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if appState.scanning}
          <option>{UI.OPTION_SCANNING}</option>
        {:else if appState.vrmList.length === 0}
          <option>{UI.OPTION_NO_VRM}</option>
        {:else}
          {#each appState.vrmList as v (v.url)}
            <option value={v.name}>{v.name}</option>
          {/each}
        {/if}
      </select>
    </div>

    <!-- Animation picker -->
    <div class="flex items-center gap-2 px-2 py-1">
      <Label class="text-muted-foreground w-10 text-xs font-normal">
        {UI.LABEL_ANIMATION}
      </Label>
      <select
        bind:value={appState.selectedAnim}
        disabled={appState.animList.length === 0}
        onclick={(e) => e.stopPropagation()}
        onchange={close}
        class="border-input bg-background text-foreground focus:ring-ring ring-offset-background placeholder:text-muted-foreground h-7 w-full rounded-md border px-2 text-xs shadow-sm focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{UI.OPTION_PICK_ANIM}</option>
        {#each appState.animList.filter((a) => a.url.includes("/dance/")) as a (a.url)}
          <option value={a.url}>{a.name}</option>
        {/each}
      </select>
    </div>

    <Separator class="my-1" />

    <!-- Pin -->
    <Button
      variant="ghost"
      size="sm"
      onclick={togglePin}
      class="w-full justify-start px-2 font-normal text-xs"
    >
      <span aria-hidden="true" class="w-4 text-center">
        {pinned ? "✓" : "　"}
      </span>
      <span>{UI.BUTTON_ALWAYS_ON_TOP}</span>
    </Button>

    <!-- MCP Status -->
    <Separator class="my-1" />

    <div class="mcp-status px-3 py-2 bg-white/5 rounded-md text-xs">
      <!-- AI State indicator -->
      <div class="status-row">
        <span
          class="state-dot"
          style="background: {STATE_COLORS[appState.aiState]}"
        ></span>
        <span class="status-label font-semibold">{displayStateLabel}</span>
        {#if appState.aiState === "thinking"}
          <span class="thinking-timer">⏱ {thinkingElapsed}</span>
        {/if}
      </div>

      <!-- Counters -->
      <div class="status-row counters">
        <span title="Files written">📝{appState.counters.filesWritten}</span>
        <span title="Commands run">⚡{appState.counters.commandsRun}</span>
        <span title="Errors">❌{appState.counters.errors}</span>
        <button
          onclick={resetCounters}
          class="ml-6 cursor-pointer border-none bg-transparent p-0 text-[12px] text-muted-foreground/80 hover:text-destructive transition-colors"
          title="Reset counters"
        >↺</button>
      </div>

    </div>
  </div>
{/if}
