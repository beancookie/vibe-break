<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";

  let { text, link, onclose }: {
    text: string;
    link?: string;
    onclose: () => void;
  } = $props();

  const y = 15 + Math.random() * 65;
  let paused = $state(false);

  function handleClick() {
    onclose();
    if (link) openUrl(link).catch(() => window.open(link, "_blank"));
  }
</script>

<div
  class="barrage-item"
  style="top: {y}%; animation-play-state: {paused ? 'paused' : 'running'}"
  role="button"
  tabindex="0"
  onclick={handleClick}
  onkeydown={(e) => { if (e.key === "Enter") handleClick(); }}
  onmouseenter={() => { paused = true; }}
  onmouseleave={() => { paused = false; }}
  onanimationend={onclose}
>
  {text}
</div>

<style>
  .barrage-item {
    position: fixed;
    z-index: 15;
    white-space: nowrap;
    padding: 6px 16px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    line-height: 1.4;
    cursor: pointer;
    user-select: none;
    pointer-events: auto;
    animation: barrage-item-fly 9s linear forwards;
  }
  .barrage-item:hover {
    background: rgba(0, 0, 0, 0.7);
  }
  @keyframes barrage-item-fly {
    from { transform: translateX(100vw); }
    to { transform: translateX(-100%); }
  }
</style>
