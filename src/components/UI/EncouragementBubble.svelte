<script lang="ts">
  import { appState } from "$lib/stores.svelte";

  const MESSAGES = [
    "写得不错！🎉",
    "继续加油！💪",
    "效率很高！⚡",
    "任务完成！✨",
    "Nice work! 🌟",
  ];

  const AUTO_DISMISS_MS = 3000;
  const ENCOURAGE_WRITE_EVERY = 5;
  const ENCOURAGE_EXEC_EVERY = 10;

  let visible = $state(false);
  let isError = $state(false);
  let text = $state("");

  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  function show(msg: string, error: boolean) {
    text = msg;
    isError = error;
    visible = true;
    if (dismissTimer !== null) clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => {
      visible = false;
      if (isError) appState.mcpUi.showErrorFeedback = false;
    }, AUTO_DISMISS_MS);
  }

  let lastWritten = $state(0);
  let lastCommands = $state(0);

  $effect(() => {
    const w = appState.counters.filesWritten;
    const c = appState.counters.commandsRun;

    if (w > 0 && w !== lastWritten && w % ENCOURAGE_WRITE_EVERY === 0) {
      lastWritten = w;
      show(MESSAGES[Math.floor(Math.random() * MESSAGES.length)], false);
    }
    if (c > 0 && c !== lastCommands && c % ENCOURAGE_EXEC_EVERY === 0) {
      lastCommands = c;
      show(MESSAGES[Math.floor(Math.random() * MESSAGES.length)], false);
    }

    if (c !== lastCommands) lastCommands = c;
    if (w !== lastWritten) lastWritten = w;
  });

  $effect(() => {
    if (appState.mcpUi.showErrorFeedback) {
      show(`❌ ${appState.mcpUi.errorMsg}`, true);
    }
  });
</script>

{#if visible}
  <div class="bubble {isError ? 'error' : ''}" role="alert">
    <div class="bubble-text">{text}</div>
    <div class="bubble-counts">
      📝 {appState.counters.filesWritten}  ⚡ {appState.counters.commandsRun}
    </div>
  </div>
{/if}

<style>
  .bubble {
    position: fixed;
    top: 18%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    padding: 12px 22px;
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    color: rgba(255, 255, 255, 0.95);
    text-align: center;
    pointer-events: none;
    user-select: none;
    animation: bubble-in 0.25s ease-out;
  }
  .bubble.error {
    background: rgba(180, 40, 40, 0.7);
  }
  .bubble-text {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.5;
  }
  .bubble-counts {
    font-size: 11px;
    margin-top: 4px;
    opacity: 0.7;
  }
  @keyframes bubble-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
