import { useCallback, useEffect, useMemo, useState } from 'react';
import { Legend } from './components/Legend.tsx';
import { MapView } from './components/MapView.tsx';
import { TimelineDock } from './components/TimelineDock.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { Network } from './data/schema.ts';
import { worksEvents } from './domain/events.ts';
import type { LayerId } from './domain/lines.ts';
import { nearestStepIndex, STEPS, TODAY } from './domain/time.ts';

export interface AppProps {
  readonly network: Network;
  /** Where the timeline starts (e.g. the user's saved position). Defaults to today. */
  readonly initialTime?: number;
  readonly onTimeChange?: (t: number) => void;
  /** Account and admin controls for the top strip. */
  readonly headerActions?: React.ReactNode;
  /** A page shown instead of the map (e.g. the admin center); the timeline position is kept. */
  readonly page?: React.ReactNode;
}

export function App({ network, initialTime, onTimeChange, headerActions, page }: AppProps) {
  const [time, setTime] = useState(() => STEPS[nearestStepIndex(initialTime ?? TODAY)] ?? TODAY);
  const [hidden, setHidden] = useState<ReadonlySet<LayerId>>(new Set());
  const events = useMemo(() => worksEvents(network.sections, network.sites), [network]);

  useEffect(() => {
    onTimeChange?.(time);
  }, [time, onTimeChange]);

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
      <TopBar time={time} actions={headerActions} />
      {page ?? (
        <>
          <div className="map-area">
            <MapView network={network} time={time} hidden={hidden} />
            <Legend hidden={hidden} onToggle={toggleLayer} />
          </div>
          <TimelineDock
            time={time}
            events={events}
            sections={network.sections}
            sites={network.sites}
            onTimeChange={setTime}
          />
        </>
      )}
    </div>
  );
}
