/** Системний шер на тач-пристроях, копіювання в буфер на десктопі. */
export async function shareOrCopy(text: string): Promise<"shared" | "copied"> {
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  if (isTouchDevice && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      /* користувач скасував — падаємо в копіювання */
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
