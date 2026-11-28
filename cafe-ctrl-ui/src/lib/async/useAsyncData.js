import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads data for a screen: { data, error, loading, reload }.
 * Stale responses (deps changed, or the screen closed) are ignored. With keepPrevious (default), the old data
 * stays on screen while a refresh loads, so lists don't flash empty on polling / filter changes.
 */
export function useAsyncData(loader, deps = [], { keepPrevious = true, enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled });
  const seq = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState(s => ({ data: keepPrevious ? s.data : undefined, error: null, loading: true }));
    try {
      const data = await loaderRef.current();
      if (mine === seq.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (mine === seq.current) setState(s => ({ data: keepPrevious ? s.data : undefined, error, loading: false }));
      return undefined;
    }
  }, [keepPrevious]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    return () => { seq.current++; }; // ignore anything still in flight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { ...state, reload: load };
}

/** True only once `flag` has stayed true for `delayMs` (avoids spinner flicker on fast loads). */
export function useDelayedFlag(flag, delayMs = 300) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) { setShown(false); return undefined; }
    const t = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(t);
  }, [flag, delayMs]);
  return shown;
}

/**
 * Loading status for a screen whose loader fills its own state (the existing `load()` pattern):
 *   const { loading, error, loaded, reload } = useLoadStatus(async ({ isStale }) => { ...; if (isStale()) return; setX(data); }, [deps]);
 * - runs on mount and whenever deps change; `reload()` re-runs it (safe to call after a save/delete; it never throws)
 * - `loaded` stays true after the first success, so refreshes/polling keep the old data on screen
 * - the loader should throw on failure; the error is kept for PageState (error + Try again, or a "couldn't refresh" banner)
 * - `isStale()` is true once a newer load started or the screen closed: check it before setting state
 * - pollMs: refresh in the background every N ms (paused while the tab is hidden)
 */
export function useLoadStatus(loader, deps = [], { pollMs } = {}) {
  const [state, setState] = useState({ loading: true, error: null, loaded: false });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    const isStale = () => !alive.current || mine !== seq.current;
    setState(s => ({ ...s, loading: true }));
    try {
      await loaderRef.current({ isStale });
      if (!isStale()) setState({ loading: false, error: null, loaded: true });
    } catch (error) {
      if (!isStale()) setState(s => ({ ...s, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    setState(s => ({ ...s, loaded: false, error: null }));
    reload();
    let timer;
    if (pollMs) {
      timer = setInterval(() => { if (typeof document === "undefined" || !document.hidden) reload(); }, pollMs);
    }
    return () => { alive.current = false; seq.current++; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, pollMs]);

  return { ...state, reload };
}
