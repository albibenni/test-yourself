import {
  type MouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent,
} from "react";

const DEAD_ZONE_PX = 10;
const MAX_SCROLL_PER_FRAME = 36;
const SCROLL_SPEED_MULTIPLIER = 0.15;
const WHEEL_TICK_SCROLL_PX = 96;

interface ScrollState {
  active: boolean;
  originY: number;
  pointerY: number;
  animationFrame: number | null;
}

export interface AutoScrollIndicator {
  direction: "idle" | "up" | "down";
  x: number;
  y: number;
}

/**
 * Enables browser-style auto-scroll: middle-click to start, then move above or
 * below the starting point to control the scroll direction and speed. A second
 * middle-click stops scrolling.
 */
export function useMiddleClickScroll(
  scrollContainerRef: RefObject<HTMLElement | null>,
) {
  const [indicator, setIndicator] = useState<AutoScrollIndicator | null>(null);
  const stateRef = useRef<ScrollState>({
    active: false,
    originY: 0,
    pointerY: 0,
    animationFrame: null,
  });

  const handleMouseMove = useCallback((event: globalThis.MouseEvent) => {
    const state = stateRef.current;
    state.pointerY = event.clientY;
    const distance = event.clientY - state.originY;
    setIndicator((current) =>
      current
        ? {
            ...current,
            direction:
              Math.abs(distance) <= DEAD_ZONE_PX
                ? "idle"
                : distance < 0
                  ? "up"
                  : "down",
          }
        : null,
    );
  }, []);

  const stopScrolling = useCallback(() => {
    const state = stateRef.current;
    state.active = false;
    setIndicator(null);
    if (state.animationFrame !== null) {
      window.cancelAnimationFrame(state.animationFrame);
      state.animationFrame = null;
    }
    window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  const scroll = useCallback(() => {
    const state = stateRef.current;
    if (!state.active) return;

    const distance = state.pointerY - state.originY;
    const distanceOutsideDeadZone = Math.abs(distance) - DEAD_ZONE_PX;
    if (distanceOutsideDeadZone > 0) {
      const speed = Math.min(
        MAX_SCROLL_PER_FRAME,
        distanceOutsideDeadZone * SCROLL_SPEED_MULTIPLIER,
      );
      scrollContainerRef.current?.scrollBy({
        top: Math.sign(distance) * speed,
        behavior: "auto",
      });
    }

    state.animationFrame = window.requestAnimationFrame(scroll);
  }, [scrollContainerRef]);

  const onMouseDown = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const state = stateRef.current;
      if (event.button !== 1) {
        if (state.active) stopScrolling();
        return;
      }

      // Prevent the webview's platform-specific middle-click behavior.
      event.preventDefault();
      if (state.active) {
        stopScrolling();
        return;
      }

      state.active = true;
      state.originY = event.clientY;
      state.pointerY = event.clientY;
      setIndicator({ direction: "idle", x: event.clientX, y: event.clientY });
      window.addEventListener("mousemove", handleMouseMove);
      state.animationFrame = window.requestAnimationFrame(scroll);
    },
    [handleMouseMove, scroll, stopScrolling],
  );

  useEffect(() => stopScrolling, [stopScrolling]);

  const onAuxClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (event.button === 1) event.preventDefault();
  }, []);

  const onWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      // Line-mode events represent discrete mouse-wheel ticks. Pixel-mode
      // events are left to the webview so touchpad scrolling remains natural.
      if (
        event.deltaMode !== globalThis.WheelEvent.DOM_DELTA_LINE ||
        event.deltaY === 0
      )
        return;

      event.preventDefault();
      scrollContainerRef.current?.scrollBy({
        top: event.deltaY * WHEEL_TICK_SCROLL_PX,
        behavior: "auto",
      });
    },
    [scrollContainerRef],
  );

  return { indicator, onAuxClick, onMouseDown, onWheel };
}
