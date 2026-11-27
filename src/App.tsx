import { useCallback, useEffect, useMemo, useState } from 'react';
import { Legend } from './components/Legend.tsx';
import { MapView } from './components/MapView.tsx';
import { TimelinePanel } from './components/TimelinePanel.tsx';
import type { Network } from './data/schema.ts';
import { worksEvents } from './domain/events.ts';
import type { LayerId } from './domain/lines.ts';
import { nearestStepIndex, STEPS, TODAY } from './domain/time.ts';

export const PLAY_INTERVAL_MS = 1800;

export interface AppProps {
  readonly network: Network;
  /** Where the timeline starts (e.g. the user's saved position). Defaults to today. */
  readonly initialTime?: number;
  readonly onTimeChange?: (t: number) => void;
  /** Rendered at the bottom of the timeline panel (account controls). */
  readonly panelFooter?: React.ReactNode;
}

export function App({ network, initialTime, onTimeChange, panelFooter }: AppProps) {
  const [time, setTime] = useState(() => STEPS[nearestStepIndex(initialTime ?? TODAY)] ?? TODAY);
  const [playing, setPlaying] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<LayerId>>(new Set());
  const events = useMemo(() => worksEvents(network.sections, network.sites), [network]);

  useEffect(() => {
    onTimeChange?.(time);
  }, [time, onTimeChange]);

  // Playback steps through the works events; it starts from the first event when at the end.
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => {
      setTime((t) => {
        const next = events.find((e) => e > t);
        if (next === undefined) {
          setPlaying(false);
          return t;
        }
        return next;
      });
    }, PLAY_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, [playing, events]);

  const changeTime = useCallback((t: number) => {
    setPlaying(false);
    setTime(t);
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const last = events.at(-1);
    const first = events[0];
    if (last !== undefined && first !== undefined && time >= last) setTime(first);
    setPlaying(true);
  }, [playing, events, time]);

  const toggleLayer = useCallback((id: LayerId, visible: boolean) => {
    setHidden((h) => {
      const next = new Set(h);
      if (visible) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="app" dir="rtl">
      <MapView network={network} time={time} hidden={hidden} />
      <TimelinePanel
        time={time}
        events={events}
        sections={network.sections}
        sites={network.sites}
        playing={playing}
        onTimeChange={changeTime}
        onTogglePlay={togglePlay}
      >
        {panelFooter}
      </TimelinePanel>
      <Legend hidden={hidden} onToggle={toggleLayer} />
    </div>
  );
}
