import { useEffect, useState } from 'react';

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 0 → 1 over `ms` after mount (for shapes that just appeared); 1 at once when motion is reduced. */
export function useFadeIn(ms = 300): number {
  const [reduced] = useState(reducedMotion);
  const [f, setF] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return undefined;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setF(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [ms, reduced]);
  return f;
}
