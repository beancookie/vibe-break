<script lang="ts">
  import { onMount } from "svelte";

  let { text, link, track, onexpired, onblock }: {
    text: string;
    link?: string;
    track: number;
    onexpired: (text: string) => void;
    onblock: (text: string, link?: string) => void;
  } = $props();

  const TRACK_COUNT = 10;
  let y = $derived(3 + track * (72 / TRACK_COUNT));
  let delay = $derived(track * 1.5);
  const duration = 7 + Math.random() * 4;
  let paused = $state(false);
  let timer: ReturnType<typeof setTimeout>;

  let DURATION_MS = $derived((duration + delay) * 1000);

  onMount(() => {
    timer = setTimeout(() => onexpired(text), DURATION_MS);
    return () => clearTimeout(timer);
  });


</script>

<div
  class="barrage-item"
  style="top: {y}%; animation-delay: {delay}s; animation-duration: {duration}s; animation-play-state: {paused ? 'paused' : 'running'}"
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
    transform: translateX(100vw);
    animation-name: barrage-item-fly;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }
  .barrage-item:hover {
    background: rgba(0, 0, 0, 0.7);
  }
  @keyframes barrage-item-fly {
    from { transform: translateX(100vw); }
    to { transform: translateX(-100%); }
  }
</style>
