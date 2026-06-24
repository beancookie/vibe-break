<script lang="ts" module>
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { type VariantProps, tv } from "tailwind-variants";

  export const buttonVariants = tv({
    base: "ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        ghost: "hover:bg-accent hover:text-accent-foreground justify-start",
        outline:
          "border-input bg-background hover:bg-accent hover:text-accent-foreground border",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  });
</script>

<script lang="ts">
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  type Variant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
  type Size = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

  type Props = HTMLButtonAttributes & {
    variant?: Variant;
    size?: Size;
    ref?: HTMLElement | null;
    children?: Snippet;
  };

  let {
    class: className,
    variant = "default",
    size = "default",
    ref = $bindable(null),
    type = "button",
    children,
    ...rest
  }: Props = $props();
</script>

<button
  bind:this={ref}
  class={cn(buttonVariants({ variant, size }), className)}
  {type}
  {...rest}
>
  {@render children?.()}
</button>
