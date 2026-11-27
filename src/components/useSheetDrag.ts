import { useRef, useState } from 'react';

/** Drag distance (px) that counts as a drag rather than a tap. */
const SLOP = 6;

/**
 * Pointer handlers for a bottom sheet's handle: `dy` follows the finger while dragging (negative = up), `onRelease`
 * gets the final distance, and a tap (or Enter / Space on the handle) calls `onTap`.
 */
export function useSheetDrag(onRelease: (dy: number) => void, onTap: () => void) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  const dragged = useRef(false);
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      start.current = e.clientY;
      dragged.current = false;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Without pointer capture the drag still works while the finger stays on the handle.
      }
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (start.current === null) return;
      const d = e.clientY - start.current;
      if (Math.abs(d) > SLOP) dragged.current = true;
      if (dragged.current) setDy(d);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      if (start.current === null) return;
      const d = e.clientY - start.current;
      start.current = null;
      setDy(0);
      if (dragged.current) onRelease(d);
    },
    onPointerCancel: () => {
      start.current = null;
      setDy(0);
    },
    onClick: () => {
      // The click that ends a drag is not a tap.
      if (dragged.current) {
        dragged.current = false;
        return;
      }
      onTap();
    },
  };
  return { dy, handlers };
}

/** Distance (px) a release must travel to move the sheet to the next snap point. */
export const SNAP_PX = 50;
