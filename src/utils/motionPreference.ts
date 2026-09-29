export function shouldReduceMotion() {
  const preference = document.documentElement.dataset.reducedMotion;
  return (
    preference === "reduce" ||
    (preference !== "reduce" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}
