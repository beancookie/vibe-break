<script lang="ts">
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  type Props = {
    class?: string;
    orientation?: "horizontal" | "vertical";
    children?: Snippet;
  };

  let {
    class: className,
    orientation = "horizontal",
    children,
    ...rest
  }: Props = $props();
</script>

<div
  role="separator"
  aria-orientation={orientation}
  class={cn(
    "bg-border shrink-0",
    orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</div>
