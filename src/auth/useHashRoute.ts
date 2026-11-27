import { useCallback, useEffect, useState } from 'react';

export type Route = 'map' | 'admin';

function current(): Route {
  return window.location.hash === '#admin' ? 'admin' : 'map';
}

/** A two-page router on the URL hash, so the browser's back button leaves the admin center. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(current);
  useEffect(() => {
    const onChange = () => {
      setRoute(current());
    };
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  const navigate = useCallback((r: Route) => {
    if (r === 'admin') window.location.hash = 'admin';
    else if (window.location.hash !== '') window.history.back();
  }, []);
  return [route, navigate];
}
