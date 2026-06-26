<script lang="ts">
  import { T } from "@threlte/core";
  import CameraRig from "./CameraRig.svelte";
  import VrmModel from "./VrmModel.svelte";
</script>

<CameraRig />
<T.AmbientLight intensity={0.55} />
<T.DirectionalLight position={[0, 2.2, 1.2]} intensity={1.2} />
<T.DirectionalLight position={[1.2, 1.4, 0.6]} intensity={0.35} />
<T.DirectionalLight position={[-0.8, 1.6, -1]} intensity={0.5} />
<VrmModel />