import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { MapView } from './components/MapView.tsx';
import { SidePanel, type PanelTab } from './components/SidePanel.tsx';
import { TimelineBar } from './components/TimelineBar.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { Network } from './data/schema.ts';
import { worksEvents } from './domain/events.ts';
import type { LayerId } from './domain/lines.ts';
import { markersFor } from './domain/markers.ts';
import { nearestStepIndex, STEPS, TODAY } from './domain/time.ts';
import type { MapsConfig } from './map/config.ts';
import { placeFromGoogle } from './places/google.ts';
import { CandidateCard, SavedPlaceCard } from './places/PlaceCards.tsx';
import { PlaceDetailsPanel } from './places/PlaceDetailsPanel.tsx';
import { PlaceSearch } from './places/PlaceSearch.tsx';
import { PlacesLayer } from './places/PlacesLayer.tsx';
import { PlacesList } from './places/PlacesList.tsx';
import type { NewPlace, PlacesStore, SavedPlace } from './places/types.ts';
import { usePlaces } from './places/usePlaces.ts';

export interface AppProps {
  readonly network: Network;
  /** Google Maps API key and map ID; without them the map area explains what is missing. */
  readonly maps: MapsConfig | null;
  /** The user's places of interest; without a store the places features are hidden. */
  readonly places?: PlacesStore | null;
  /** Where the timeline starts (e.g. the user's saved position). Defaults to today. */
  readonly initialTime?: number;
  readonly onTimeChange?: (t: number) => void;
  /** Account and admin controls for the top strip. */
  readonly headerActions?: React.ReactNode;
  /** A page shown instead of the map (e.g. the admin center); the timeline position is kept. */
  readonly page?: React.ReactNode;
}

interface Details {
  readonly googlePlaceId: string;
  readonly name: string;
}

/** Narrow screens (phones) start with the side panel closed; it opens over the map. */
function isNarrow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(width <= 800px)').matches;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The map with the places search and pins. Rendered only inside the Google Maps API provider. */
function MapArea({
  network,
  time,
  hidden,
  mapId,
  store,
  places,
  candidate,
  selectedId,
  card,
  onPick,
  onSelect,
  onCloseCard,
}: {
  network: Network;
  time: number;
  hidden: ReadonlySet<LayerId>;
  mapId: string;
  store: PlacesStore | null;
  places: readonly SavedPlace[];
  candidate: NewPlace | null;
  selectedId: string | null;
  card: React.ReactNode;
  onPick: (place: NewPlace) => void;
  onSelect: (id: string) => void;
  onCloseCard: () => void;
}) {
  const placesLib = useMapsLibrary('places');
  const [error, setError] = useState<string | null>(null);
  const pick = useCallback(
    (p: NewPlace) => {
      setError(null);
      onPick(p);
    },
    [onPick],
  );

  return (
    <>
      <MapView
        network={network}
        time={time}
        hidden={hidden}
        mapId={mapId}
        {...(store && placesLib
          ? {
              onPoiClick: (placeId: string) => {
                placeFromGoogle(new placesLib.Place({ id: placeId }))
                  .then((p) => {
                    if (p) pick(p);
                  })
                  .catch((e: unknown) => {
                    setError(errorText(e));
                  });
              },
            }
          : {})}
      >
        {store && (
          <PlacesLayer
            places={places}
            candidate={candidate}
            selectedId={selectedId}
            onSelect={onSelect}
            card={card}
            onCloseCard={onCloseCard}
          />
        )}
      </MapView>
      {store && (
        <div className="map-search">
          <PlaceSearch onPick={pick} onError={setError} />
          {error !== null && (
            <div className="search-error" role="alert">
              {error}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function App({
  network,
  maps,
  places: store = null,
  initialTime,
  onTimeChange,
  headerActions,
  page,
}: AppProps) {
  const [time, setTime] = useState(() => STEPS[nearestStepIndex(initialTime ?? TODAY)] ?? TODAY);
  const [hidden, setHidden] = useState<ReadonlySet<LayerId>>(new Set());
  const [tab, setTab] = useState<PanelTab | null>(() => (isNarrow() ? null : 'trains'));
  const [lastTab, setLastTab] = useState<PanelTab>('trains');
  const openTab = useCallback((t: PanelTab | null) => {
    setTab(t);
    if (t !== null) setLastTab(t);
  }, []);
  const panelId = useId();
  const events = useMemo(() => worksEvents(network.sections, network.sites), [network]);
  const markers = useMemo(() => markersFor(events), [events]);

  const places = usePlaces(store);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<NewPlace | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const selected = places.items.find((p) => p.id === selectedId) ?? null;

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

  const pick = useCallback((p: NewPlace) => {
    setCandidate(p);
    setSelectedId(null);
  }, []);

  const select = useCallback((id: string) => {
    setCandidate(null);
    setSelectedId(id);
  }, []);

  let card: React.ReactNode = null;
  if (store && candidate) {
    card = (
      <CandidateCard
        place={candidate}
        onSave={async () => {
          const id = await store.addPlace(candidate);
          select(id);
        }}
        onShowDetails={() => {
          setDetails({ googlePlaceId: candidate.googlePlaceId, name: candidate.name });
        }}
        onCancel={() => {
          setCandidate(null);
        }}
      />
    );
  } else if (store && selected) {
    card = (
      <SavedPlaceCard
        key={selected.id}
        store={store}
        place={selected}
        onShowDetails={() => {
          setDetails({ googlePlaceId: selected.googlePlaceId, name: selected.name });
        }}
      />
    );
  }

  const app = (
    <div className="app" dir="rtl">
      <TopBar time={time} actions={headerActions} />
      {page ?? (
        <div className={tab === null ? 'workspace panel-closed' : 'workspace'}>
          <div className="side-column">
            <TimelineBar
              time={time}
              markers={markers}
              onTimeChange={setTime}
              panelOpen={tab !== null}
              panelId={panelId}
              onTogglePanel={() => {
                openTab(tab === null ? lastTab : null);
              }}
            />
            <SidePanel
              id={panelId}
              tab={tab}
              onTab={openTab}
              time={time}
              events={events}
              sections={network.sections}
              sites={network.sites}
              hidden={hidden}
              onTimeChange={setTime}
              onToggleLayer={toggleLayer}
              {...(store
                ? {
                    places: {
                      count: places.items.length,
                      content: (
                        <PlacesList
                          places={places.items}
                          error={places.error}
                          selectedId={selectedId}
                          onSelect={(id) => {
                            select(id);
                            // On a phone the panel covers the map; close it to show the place.
                            if (isNarrow()) openTab(null);
                          }}
                        />
                      ),
                    },
                  }
                : {})}
            />
          </div>
          <div className="map-area">
            {maps ? (
              <MapArea
                network={network}
                time={time}
                hidden={hidden}
                mapId={maps.mapId}
                store={store}
                places={places.items}
                candidate={candidate}
                selectedId={selectedId}
                card={card}
                onPick={pick}
                onSelect={select}
                onCloseCard={() => {
                  setCandidate(null);
                  setSelectedId(null);
                }}
              />
            ) : (
              <div className="map-missing" role="note">
                המפה לא הוגדרה: חסר מפתח Google Maps (<code dir="ltr">VITE_GOOGLE_MAPS_API_KEY</code>).
              </div>
            )}
          </div>
          {maps && details && (
            <PlaceDetailsPanel
              googlePlaceId={details.googlePlaceId}
              name={details.name}
              onClose={() => {
                setDetails(null);
              }}
            />
          )}
        </div>
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
