<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { PerspectiveCamera, ACESFilmicToneMapping } from "three";
  import OrbitControls from "./OrbitControls.svelte";
  import { createWindowDrag } from "$lib/useWindowDrag.svelte";

  const { renderer } = useThrelte();

  $effect(() => {
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
  });

  const drag = createWindowDrag();

  function onMove(e: MouseEvent) {
    if (e.buttons === 0) return;
    drag.onMove(e);
  }
</script>

<svelte:window
  onmousemove={onMove}
  onmousedown={drag.onMouseDown}
  onmouseup={drag.onMouseUp}
/>

<T
  is={PerspectiveCamera}
  makeDefault
  position={[0, 1.2, 3.0]}
  fov={30}
  near={0.1}
  far={100}
  oncreate={(ref) => ref.lookAt(0, 1.2, 0)}
>
  <OrbitControls />
</T>