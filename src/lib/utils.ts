import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * The standard shadcn-svelte `cn` helper - merges Tailwind class
 * lists, with later classes winning over earlier ones. Components
 * import this so the consumer can override a className by passing
 * one through.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
