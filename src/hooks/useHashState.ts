import { useCallback, useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  globalThis.addEventListener('hashchange', callback)
  return () => {
    globalThis.removeEventListener('hashchange', callback)
  }
}

function readParam(key: string): string | undefined {
  const value = new URLSearchParams(globalThis.location.hash.slice(1)).get(key)
  return value === null || value === '' ? undefined : value
}

/** A string value stored in the URL hash (`#key=value&...`) so views can be shared. */
export function useHashParam(
  key: string,
): [string | undefined, (value: string | undefined) => void] {
  const value = useSyncExternalStore(subscribe, () => readParam(key))
  const setValue = useCallback(
    (next: string | undefined) => {
      const params = new URLSearchParams(globalThis.location.hash.slice(1))
      if (next === undefined) {
        params.delete(key)
      } else {
        params.set(key, next)
      }
      const hash = params.toString()
      globalThis.history.replaceState(
        null,
        '',
        hash === '' ? globalThis.location.pathname : `#${hash}`,
      )
      globalThis.dispatchEvent(new HashChangeEvent('hashchange'))
    },
    [key],
  )
  return [value, setValue]
}
