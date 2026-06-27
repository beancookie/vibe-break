<script lang="ts">
  import { onMount } from "svelte";

  let { text, link, onexpired, onblock }: {
    text: string;
    link?: string;
    onexpired: (text: string) => void;
    onblock: (text: string, link?: string) => void;
  } = $props();

  const y = 15 + Math.random() * 65;
  let paused = $state(false);
  let timer: ReturnType<typeof setTimeout>;

  const DURATION_MS = 9000;

  onMount(() => {
    timer = setTimeout(() => onexpired(text), DURATION_MS);
    return () => clearTimeout(timer);
  });


</script>

<div
  class="barrage-item"
  style="top: {y}%; animation-play-state: {paused ? 'paused' : 'running'}"
  role="button"
  tabindex="0"
  onclick={() => onblock(text, link)}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onblock(text, link); } }}
  onmouseenter={() => { paused = true; }}
  onmouseleave={() => { paused = false; }}
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
