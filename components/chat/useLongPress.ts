import {
  useCallback,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from "react";

export const LONG_PRESS_MS = 500;
const DEFAULT_MS = LONG_PRESS_MS;

export function useLongPress(
  onLongPress: (coords: { clientX: number; clientY: number }) => void,
  ms = DEFAULT_MS,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coordsRef = useRef({ clientX: 0, clientY: 0 });

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (clientX: number, clientY: number) => {
      coordsRef.current = { clientX, clientY };
      cancel();
      timerRef.current = setTimeout(() => {
        onLongPress(coordsRef.current);
        timerRef.current = null;
      }, ms);
    },
    [cancel, ms, onLongPress],
  );

  const pointerHandlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      start(e.clientX, e.clientY);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };

  const touchHandlers = {
    onTouchStart: (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      start(touch.clientX, touch.clientY);
    },
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onTouchCancel: cancel,
  };

  const contextMenuHandler = (e: MouseEvent) => {
    e.preventDefault();
    onLongPress({ clientX: e.clientX, clientY: e.clientY });
  };

  return { pointerHandlers, touchHandlers, contextMenuHandler, cancel };
}
