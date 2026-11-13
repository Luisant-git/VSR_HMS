import { useCallback, useEffect, useState } from 'react';

/**
 * Small async data hook used by the biometric attendance pages. The caller
 * supplies the dependency list (filters/page) exactly like useEffect.
 */
export function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load biometric data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // The caller owns the dependency list; fetcher is intentionally excluded
    // so pages can pass an inline arrow without causing an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  return {
    data,
    loading,
    error,
    reload,
  };
}
