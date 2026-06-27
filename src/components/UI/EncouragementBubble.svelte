<script lang="ts">
  import { appState } from "$lib/stores.svelte";

  const TYPING_INTERVAL_MS = 60;
  const HOLD_DURATION_MS = 5000;

  let visible = $state(false);
  let fadingOut = $state(false);
  let typewriterText = $state("");
  let isTyping = $state(false);
  let fullText = $state("");

  let typingTimer: ReturnType<typeof setInterval> | null = null;
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  function resetTimers() {
    if (typingTimer !== null) clearInterval(typingTimer);
    typingTimer = null;
    if (dismissTimer !== null) clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  function startTyping(msg: string) {
    resetTimers();
    fullText = msg;
    typewriterText = "";
    isTyping = true;
    fadingOut = false;
    visible = true;

    let i = 0;
    typingTimer = setInterval(() => {
      i++;
      typewriterText = msg.slice(0, i);
      if (i >= msg.length) {
        if (typingTimer !== null) clearInterval(typingTimer);
        typingTimer = null;
        isTyping = false;
        dismissTimer = setTimeout(() => {
          fadingOut = true;
          setTimeout(() => {
            visible = false;
            appState.mcpUi.encourageMessage = "";
          }, 300);
        }, HOLD_DURATION_MS);
      }
    }, TYPING_INTERVAL_MS);
  }

  $effect(() => {
    const msg = appState.mcpUi.encourageMessage;
    if (msg) {
      startTyping(msg);
    }
  });
</script>

{#if visible}
  <div class="bubble" class:fadingOut>
    <div class="bubble-text">
      {typewriterText}
      {#if isTyping}<span class="cursor">|</span>{/if}
    </div>
  </div>
{/if}

<style>
  .bubble {
    position: fixed;
    top: 4%;
    right: 48px;
    z-index: 20;
    max-width: 260px;
    padding: 16px 24px;
    background: linear-gradient(135deg, #ffffff 0%, #f0f8ff 100%);
    border-radius: 28px 44px 36px 36px;
    color: #4a6a7a;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.5;
    box-shadow: 0 4px 24px rgba(156, 189, 219, 0.25);
    pointer-events: none;
    user-select: none;
    animation: bubble-float 0.4s ease-out forwards;
    transition: opacity 0.3s ease-in, transform 0.3s ease-in;
  }
  .bubble.fadingOut {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }

  .cursor {
    animation: blink 0.6s step-end infinite;
    color: #8ab4d0;
    font-weight: 400;
  }

  @keyframes bubble-float {
    0% {
      transform: translateY(20px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
</style>
