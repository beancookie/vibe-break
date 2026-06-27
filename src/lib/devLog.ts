export function devLog(tag: string, ...args: unknown[]) {
  console.log(`[${tag}]`, ...args);
}
