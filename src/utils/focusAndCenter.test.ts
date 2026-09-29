import { afterEach, describe, expect, it, vi } from "vitest";
import { focusAndCenter } from "./focusAndCenter";

describe("focusAndCenter", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-reduced-motion");
    vi.restoreAllMocks();
  });

  it("focuses without implicit scrolling and smoothly centers the container", () => {
    const focusTarget = document.createElement("button");
    const scrollTarget = document.createElement("section");
    const focus = vi.spyOn(focusTarget, "focus");
    const scrollIntoView = vi.fn();
    scrollTarget.scrollIntoView = scrollIntoView;

    focusAndCenter(focusTarget, scrollTarget);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("centers without animation when reduced motion is enabled", () => {
    document.documentElement.dataset.reducedMotion = "reduce";
    const focusTarget = document.createElement("button");
    const scrollTarget = document.createElement("section");
    const scrollIntoView = vi.fn();
    scrollTarget.scrollIntoView = scrollIntoView;

    focusAndCenter(focusTarget, scrollTarget);

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    });
  });

  it("honors the operating system reduced-motion preference", () => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query) =>
        ({
          matches: query === "(prefers-reduced-motion: reduce)",
        }) as MediaQueryList,
    );
    const focusTarget = document.createElement("button");
    const scrollTarget = document.createElement("section");
    const scrollIntoView = vi.fn();
    scrollTarget.scrollIntoView = scrollIntoView;

    focusAndCenter(focusTarget, scrollTarget);

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    });
  });

  it("still focuses when centering is unavailable", () => {
    const focusTarget = document.createElement("button");
    const focus = vi.spyOn(focusTarget, "focus");

    expect(() => focusAndCenter(focusTarget, null)).not.toThrow();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
