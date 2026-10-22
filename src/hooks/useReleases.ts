"use client";

import { useCallback, useEffect, useState } from "react";
import type { Release } from "../../zenstack/models";

// Dates arrive as ISO strings after JSON serialization, not Date instances.
type ReleaseDto = Omit<Release, "releaseDate" | "preOrderCloseDate" | "createdAt" | "updatedAt"> & {
  releaseDate: string;
  preOrderCloseDate: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export function useReleases() {
  const [releases, setReleases] = useState<ReleaseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/releases");
      if (!res.ok) {
        throw new Error(`Failed to fetch releases (${res.status})`);
      }
      setReleases(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch releases"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // isLoading starts true, so the initial load needs no synchronous setState.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    (async () => {
      try {
        const res = await fetch("/api/releases", { signal });
        if (!res.ok) {
          throw new Error(`Failed to fetch releases (${res.status})`);
        }
        const data: ReleaseDto[] = await res.json();
        if (signal.aborted) return;
        setReleases(data);
      } catch (err) {
        if (signal.aborted) return;
        setError(err instanceof Error ? err : new Error("Failed to fetch releases"));
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  return { releases, isLoading, error, refetch };
}
