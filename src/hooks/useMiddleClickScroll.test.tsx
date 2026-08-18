import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMiddleClickScroll } from "./useMiddleClickScroll";

function ScrollArea() {
  const ref = useRef<HTMLDivElement>(null);
  const { announcement, indicator, onMouseDown, onWheel } =
    useMiddleClickScroll(ref);
  return (
    <div
      data-testid="scroll-area"
      onMouseDown={onMouseDown}
      onWheel={onWheel}
      ref={ref}
    >
      {indicator && (
        <output data-testid="indicator">{indicator.direction}</output>
      )}
      <output data-testid="announcement">{announcement}</output>
    </div>
  );
}

describe("useMiddleClickScroll", () => {
  let animationFrames: FrameRequestCallback[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    animationFrames = [];
    document.documentElement.removeAttribute("data-reduced-motion");
  });

  function mockAnimationFrame() {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
      () => undefined,
    );
  }

  it("scrolls down when the pointer moves below the middle-click origin", () => {
    mockAnimationFrame();
    const { getByTestId } = render(<ScrollArea />);
    const area = getByTestId("scroll-area");
    const scrollBy = vi.fn();
    Object.defineProperty(area, "scrollBy", { value: scrollBy });

    fireEvent.mouseDown(area, { button: 1, clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 160 });
    animationFrames[0]?.(0);

    expect(scrollBy).toHaveBeenCalledWith({ top: 25, behavior: "auto" });
    expect(getByTestId("indicator")).toHaveTextContent("down");
  });

  it("scrolls up when the pointer moves above the middle-click origin", () => {
    mockAnimationFrame();
    const { getByTestId } = render(<ScrollArea />);
    const area = getByTestId("scroll-area");
    const scrollBy = vi.fn();
    Object.defineProperty(area, "scrollBy", { value: scrollBy });

    fireEvent.mouseDown(area, { button: 1, clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 40 });
    animationFrames[0]?.(0);

    expect(scrollBy).toHaveBeenCalledWith({ top: -25, behavior: "auto" });
  });

  it("caps the speed when the pointer is far from the overlay", () => {
    mockAnimationFrame();
    const { getByTestId } = render(<ScrollArea />);
    const area = getByTestId("scroll-area");
    const scrollBy = vi.fn();
    Object.defineProperty(area, "scrollBy", { value: scrollBy });

    fireEvent.mouseDown(area, { button: 1, clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 1_000 });
    animationFrames[0]?.(0);

    expect(scrollBy).toHaveBeenCalledWith({ top: 120, behavior: "auto" });
  });

  it("keeps scrolling after release and stops on a second middle-click", () => {
    mockAnimationFrame();
    const { getByTestId } = render(<ScrollArea />);
    const area = getByTestId("scroll-area");
    const scrollBy = vi.fn();
    Object.defineProperty(area, "scrollBy", { value: scrollBy });

    fireEvent.mouseDown(area, { button: 0, clientY: 100 });
    expect(animationFrames).toHaveLength(0);

    fireEvent.mouseDown(area, { button: 1, clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 160 });
    fireEvent.mouseUp(window);
    animationFrames[0]?.(0);

    expect(scrollBy).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(area, { button: 1, clientY: 160 });
    animationFrames[1]?.(0);

    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(2);
    expect(() => getByTestId("indicator")).toThrow();
  });

  it("stops on a primary click", () => {
    mockAnimationFrame();
    const { getByTestId } = render(<ScrollArea />);
    const area = getByTestId("scroll-area");
    const scrollBy = vi.fn();
    Object.defineProperty(area, "scrollBy", { value: scrollBy });

    fireEvent.mouseDown(area, { button: 1, clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 160 });
    fireEvent.mouseDown(area, { button: 0, clientY: 160 });
    animationFrames[0]?.(0);

    expect(scrollBy).not.toHaveBeenCalled();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it("stops when Escape is pressed and announces the state change", () => {
    mockAnimationFrame();
    const { getByTestId } = render(<ScrollArea />);
    const area = getByTestId("scroll-area");

    fireEvent.mouseDown(area, { button: 1, clientY: 100 });
    expect(getByTestId("announcement")).toHaveTextContent(
      "Auto-scroll enabled",
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(getByTestId("announcement")).toHaveTextContent(
      "Auto-scroll stopped.",
    );
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it("does not activate continuous auto-scroll when reduced motion is enabled", () => {
    mockAnimationFrame();
    document.documentElement.dataset.reducedMotion = "reduce";
    const { getByTestId } = render(<ScrollArea />);

    fireEvent.mouseDown(getByTestId("scroll-area"), {
      button: 1,
      clientY: 100,
    });

    expect(animationFrames).toHaveLength(0);
    expect(getByTestId("announcement")).toHaveTextContent(
      "Auto-scroll is disabled",
    );
  });

  it("uses a larger scroll distance for line-mode wheel ticks", () => {
    const { getByTestId } = render(<ScrollArea />);
    const area = getByTestId("scroll-area");
    const scrollBy = vi.fn();
    Object.defineProperty(area, "scrollBy", { value: scrollBy });

    fireEvent.wheel(area, { deltaMode: WheelEvent.DOM_DELTA_LINE, deltaY: 1 });

    expect(scrollBy).toHaveBeenCalledWith({ top: 160, behavior: "auto" });
  });

  it("recognizes large pixel-mode deltas as mouse-wheel ticks", () => {
    const { getByTestId } = render(<ScrollArea />);
    const area = getByTestId("scroll-area");
    const scrollBy = vi.fn();
    Object.defineProperty(area, "scrollBy", { value: scrollBy });

    fireEvent.wheel(area, {
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaY: 120,
    });

    expect(scrollBy).toHaveBeenCalledWith({ top: 160, behavior: "auto" });
  });

  it("preserves small pixel-mode scrolling for touchpads", () => {
    const { getByTestId } = render(<ScrollArea />);
    const area = getByTestId("scroll-area");
    const scrollBy = vi.fn();
    Object.defineProperty(area, "scrollBy", { value: scrollBy });

    fireEvent.wheel(area, {
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaY: 20,
    });

    expect(scrollBy).not.toHaveBeenCalled();
  });
});
