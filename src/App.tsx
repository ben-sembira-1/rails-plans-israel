import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AboutDialog } from './components/AboutDialog.tsx';
import { ChangeNote } from './components/ChangeNote.tsx';
import { LayersControl } from './components/LayersControl.tsx';
import { MapView } from './components/MapView.tsx';
import { SidePanel, type PanelTab } from './components/SidePanel.tsx';
import { Toast } from './components/Toast.tsx';
import { useConstruction, type ConstructionState } from './construction/useConstruction.ts';
import { TimelineBar } from './components/TimelineBar.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { LatLng, Network } from './data/schema.ts';
import {
  CONSTRUCTION_HIDDEN_BY_DEFAULT,
  countsAt,
  projectsAt,
  type ConstructionLayer,
} from './domain/construction.ts';
import { changesBetween } from './domain/changes.ts';
import { worksEvents } from './domain/events.ts';
import type { LayerId, LineId } from './domain/lines.ts';
import { markersFor } from './domain/markers.ts';
import { nearestStepIndex, STEPS, timeFromSearch, TODAY, withTime } from './domain/time.ts';
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
  /** Overrides the construction snapshot (tests); by default it is loaded from the site. */
  readonly construction?: ConstructionState;
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
  construction,
  constructionHidden,
  mapId,
  store,
  places,
  candidate,
  selectedId,
  card,
  onPick,
  onSelect,
  onCloseCard,
  highlight,
  focus,
}: {
  highlight: LineId | null;
  focus: { readonly key: number; readonly points: readonly LatLng[] } | null;
  network: Network;
  time: number;
  hidden: ReadonlySet<LayerId>;
  construction: ConstructionState;
  constructionHidden: ReadonlySet<ConstructionLayer>;
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
        construction={construction.status === 'ready' ? construction.data : null}
        constructionHidden={constructionHidden}
        mapId={mapId}
        highlight={highlight}
        focus={focus}
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
  construction: constructionOverride,
}: AppProps) {
  // A shared link's time (`?t=`) wins over the user's saved position.
  const [time, setTime] = useState(
    () => timeFromSearch(window.location.search) ?? STEPS[nearestStepIndex(initialTime ?? TODAY)] ?? TODAY,
  );
  // The time before the user's last move, for the "what changed" note (`null` = no note).
  const [from, setFrom] = useState<number | null>(null);
  const go = useCallback(
    (t: number) => {
      if (t === time) return;
      setFrom(time);
      setTime(t);
      window.history.replaceState(window.history.state, '', withTime(window.location.href, t));
    },
    [time],
  );
  const [about, setAbout] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<LineId | null>(null);
  const [focus, setFocus] = useState<{ key: number; points: readonly LatLng[] } | null>(null);
  const focusOn = useCallback((points: readonly LatLng[]) => {
    setFocus((f) => ({ key: (f?.key ?? 0) + 1, points }));
  }, []);
  const closeAbout = useCallback(() => {
    setAbout(false);
  }, []);
  const clearToast = useCallback(() => {
    setToast(null);
  }, []);
  const share = useCallback(() => {
    const url = withTime(window.location.href, time);
    const done = (text: string) => {
      setToast(text);
    };
    if (!('clipboard' in navigator)) {
      done('ההעתקה לא נתמכת בדפדפן הזה. העתיקו את הכתובת מסרגל הכתובות.');
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => {
        done('הקישור הועתק');
      },
      () => {
        done('ההעתקה נכשלה. העתיקו את הכתובת מסרגל הכתובות.');
      },
    );
  }, [time]);
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

  const loaded = useConstruction(constructionOverride === undefined);
  const construction = constructionOverride ?? loaded;
  const [constructionHidden, setConstructionHidden] = useState<ReadonlySet<ConstructionLayer>>(
    () => new Set(CONSTRUCTION_HIDDEN_BY_DEFAULT),
  );
  const constructionCounts = useMemo(
    () => (construction.status === 'ready' ? countsAt(projectsAt(construction.data, time)) : null),
    [construction, time],
  );
  const changes = useMemo(
    () => (from === null ? [] : changesBetween(network.sections, network.sites, from, time)),
    [network, from, time],
  );
  const sitesDelta = useMemo(() => {
    if (from === null || construction.status !== 'ready' || constructionCounts === null) return null;
    const before = countsAt(projectsAt(construction.data, from)).construction;
    const now = constructionCounts.construction;
    return { now, delta: now - before };
  }, [from, construction, constructionCounts]);
  const focusLine = useCallback(
    (id: LineId) => {
      focusOn([
        ...network.sections.filter((s) => s.line === id).flatMap((s) => s.paths.flat()),
        ...network.stations.filter((s) => s.line === id).map((s) => s.position),
      ]);
    },
    [network, focusOn],
  );
  const toggleConstruction = useCallback((layer: ConstructionLayer, visible: boolean) => {
    setConstructionHidden((h) => {
      const next = new Set(h);
      if (visible) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }, []);

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
      <TopBar
        time={time}
        actions={headerActions}
        onAbout={() => {
          setAbout(true);
        }}
        onShare={share}
      />
      {page ?? (
        <div className={tab === null ? 'workspace panel-closed' : 'workspace'}>
          <div className="side-column">
            <TimelineBar time={time} markers={markers} onTimeChange={go} />
            <SidePanel
              id={panelId}
              tab={tab}
              onTab={openTab}
              lastTab={lastTab}
              time={time}
              markers={markers}
              network={network}
              onTimeChange={go}
              construction={{ state: construction, counts: constructionCounts }}
              onAbout={() => {
                setAbout(true);
              }}
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
                          onSearch={() => {
                            if (isNarrow()) openTab(null);
                            document
                              .querySelector<HTMLElement>('.place-search gmp-place-autocomplete')
                              ?.focus();
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
                construction={construction}
                constructionHidden={constructionHidden}
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
                highlight={highlight}
                focus={focus}
              />
            ) : (
              <div className="map-missing" role="note">
                המפה לא הוגדרה: חסר מפתח Google Maps (<code dir="ltr">VITE_GOOGLE_MAPS_API_KEY</code>).
              </div>
            )}
            {from !== null && changes.length > 0 && (
              <ChangeNote
                from={from}
                to={time}
                changes={changes}
                sitesDelta={sitesDelta}
                onFocus={focusOn}
                onClose={() => {
                  setFrom(null);
                }}
              />
            )}
            {maps && (
              <LayersControl
                hidden={hidden}
                onToggle={toggleLayer}
                onHighlight={setHighlight}
                onFocusLine={focusLine}
                construction={{
                  state: construction,
                  counts: constructionCounts,
                  hidden: constructionHidden,
                  onToggle: toggleConstruction,
                }}
              />
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
      {about && (
        <AboutDialog
          updated={network.updated}
          constructionUpdated={construction.status === 'ready' ? construction.data.fetchedAt : null}
          onClose={closeAbout}
        />
      )}
      {toast !== null && <Toast text={toast} onDone={clearToast} />}
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
