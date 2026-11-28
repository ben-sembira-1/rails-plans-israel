import { useMap } from '@vis.gl/react-google-maps';
import { useEffect } from 'react';

/** Space kept between an opened popup and the search box over the map. */
export const POPUP_GAP_PX = 12;
/** Google's own auto-pan has settled by then when it doesn't move the map at all. */
const SETTLE_MS = 400;

/**
 * Google pans an opened popup into view, but our search box floats over the top of the map, so on a phone the popup
 * can end up right under it. When a popup opens, this waits for that pan and then moves the map down just enough to
 * keep the popup `POPUP_GAP_PX` below the search box. It only acts on opening, never while the user drags.
 */
export function PopupClearance() {
  const map = useMap();
  useEffect(() => {
    if (!map) return undefined;
    const root = map.getDiv();
    let current: Element | null = null;
    const timers: number[] = [];
    const listeners: google.maps.MapsEventListener[] = [];

    const adjust = (popup: Element) => {
      const search = document.querySelector('.map-search');
      if (!search || !popup.isConnected) return;
      const s = search.getBoundingClientRect();
      const p = popup.getBoundingClientRect();
      if (p.right < s.left || p.left > s.right) return;
      const need = s.bottom + POPUP_GAP_PX - p.top;
      if (need > 1) map.panBy(0, -need);
    };

    const observer = new MutationObserver(() => {
      const popup = root.querySelector('.gm-style-iw-c');
      if (popup === current) return;
      current = popup;
      if (!popup) return;
      const once = google.maps.event.addListenerOnce(map, 'idle', () => {
        adjust(popup);
      });
      listeners.push(once);
      timers.push(
        window.setTimeout(() => {
          adjust(popup);
        }, SETTLE_MS),
        // Stop waiting for a pan that isn't coming, so a later drag by the user isn't corrected.
        window.setTimeout(() => {
          once.remove();
        }, SETTLE_MS * 3),
      );
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      timers.forEach((t) => {
        window.clearTimeout(t);
      });
      listeners.forEach((l) => {
        l.remove();
      });
    };
  }, [map]);
  return null;
}
