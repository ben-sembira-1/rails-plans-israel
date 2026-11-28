import { useEffect } from 'react';

export const TOAST_MS = 2500;

/** A short confirmation at the bottom of the screen, e.g. "הקישור הועתק". */
export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, TOAST_MS);
    return () => {
      clearTimeout(id);
    };
  }, [text, onDone]);
  return (
    <div className="toast" role="status">
      {text}
    </div>
  );
}
