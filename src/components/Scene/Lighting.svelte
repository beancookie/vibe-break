<script lang="ts">
  import { T } from "@threlte/core";
</script>

<T.AmbientLight intensity={0.55} />
<!-- 主光:正前方斜上方,从相机侧打向人脸 -->
<T.DirectionalLight position={[0, 2.2, 1.2]} intensity={1.2} />
<!-- 侧补光:右侧,补亮半边脸 -->
<T.DirectionalLight position={[1.2, 1.4, 0.6]} intensity={0.35} />
<!-- 轮廓光:身后侧,把人脸从背景中分离出来 -->
<T.DirectionalLight position={[-0.8, 1.6, -1]} intensity={0.5} />
