import { APIProvider } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { MapView } from './components/MapView.tsx';
import { SidePanel } from './components/SidePanel.tsx';
import { TimelineBar } from './components/TimelineBar.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { Network } from './data/schema.ts';
import { worksEvents } from './domain/events.ts';
import { markersFor } from './domain/markers.ts';
import type { MapsConfig } from './map/config.ts';
import type { LayerId } from './domain/lines.ts';
import { nearestStepIndex, STEPS, TODAY } from './domain/time.ts';

export interface AppProps {
  readonly network: Network;
  /** Google Maps API key and map ID; without them the map area explains what is missing. */
  readonly maps: MapsConfig | null;
  /** Where the timeline starts (e.g. the user's saved position). Defaults to today. */
  readonly initialTime?: number;
  readonly onTimeChange?: (t: number) => void;
  /** Account and admin controls for the top strip. */
  readonly headerActions?: React.ReactNode;
  /** A page shown instead of the map (e.g. the admin center); the timeline position is kept. */
  readonly page?: React.ReactNode;
}

export function App({ network, maps, initialTime, onTimeChange, headerActions, page }: AppProps) {
  const [time, setTime] = useState(() => STEPS[nearestStepIndex(initialTime ?? TODAY)] ?? TODAY);
  const [hidden, setHidden] = useState<ReadonlySet<LayerId>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const events = useMemo(() => worksEvents(network.sections, network.sites), [network]);
  const markers = useMemo(() => markersFor(events), [events]);

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

  const app = (
    <div className="app" dir="rtl">
      <TopBar time={time} actions={headerActions} />
      {page ?? (
        <>
          <div className="workspace">
            <div className="side-column">
              <TimelineBar
                time={time}
                markers={markers}
                onTimeChange={setTime}
                panelOpen={panelOpen}
                panelId={panelId}
                onTogglePanel={() => {
                  setPanelOpen((o) => !o);
                }}
              />
              <SidePanel
                id={panelId}
                open={panelOpen}
                time={time}
                events={events}
                sections={network.sections}
                sites={network.sites}
                hidden={hidden}
                onTimeChange={setTime}
                onToggleLayer={toggleLayer}
              />
            </div>
            <div className="map-area">
              {maps ? (
                <MapView network={network} time={time} hidden={hidden} mapId={maps.mapId} />
              ) : (
                <div className="map-missing" role="note">
                  המפה לא הוגדרה: חסר מפתח Google Maps (<code dir="ltr">VITE_GOOGLE_MAPS_API_KEY</code>).
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
  return maps ? (
    <APIProvider apiKey={maps.apiKey} language="he" region="IL">
      {app}
    </APIProvider>
  ) : (
    app
  );
}
