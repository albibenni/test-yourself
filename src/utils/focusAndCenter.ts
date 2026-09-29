import { shouldReduceMotion } from "./motionPreference";

export function focusAndCenter(
  focusTarget: HTMLElement | null,
  scrollTarget: Element | null,
) {
  if (!focusTarget) return;

  focusTarget.focus({ preventScroll: true });
  scrollTarget?.scrollIntoView?.({
    behavior: shouldReduceMotion() ? "auto" : "smooth",
    block: "center",
  });
}
