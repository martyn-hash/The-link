import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

interface PrefetchConfig {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  staleTime?: number;
}

interface UseBackgroundPrefetchOptions {
  enabled: boolean;
  prefetches: PrefetchConfig[];
  delay?: number;
}

export function useBackgroundPrefetch({
  enabled,
  prefetches,
  delay = 500,
}: UseBackgroundPrefetchOptions) {
  const hasPrefetchedRef = useRef(false);
  const prefetchesRef = useRef(prefetches);
  prefetchesRef.current = prefetches;

  const executePrefetch = useCallback(async () => {
    for (const config of prefetchesRef.current) {
      const existingData = queryClient.getQueryData(config.queryKey);
      const queryState = queryClient.getQueryState(config.queryKey);
      
      const isStale = queryState?.dataUpdatedAt 
        ? Date.now() - queryState.dataUpdatedAt > (config.staleTime || 30000)
        : true;
      
      if (existingData && !isStale) {
        continue;
      }

      try {
        await queryClient.prefetchQuery({
          queryKey: config.queryKey,
          queryFn: config.queryFn,
          staleTime: config.staleTime || 30000,
        });
      } catch (error) {
        console.debug("[Prefetch] Failed to prefetch:", config.queryKey, error);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || hasPrefetchedRef.current || prefetches.length === 0) {
      return;
    }

    hasPrefetchedRef.current = true;

    const schedulePrefetch = () => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        (window as any).requestIdleCallback(
          () => {
            executePrefetch();
          },
          { timeout: 3000 }
        );
      } else {
        setTimeout(executePrefetch, delay);
      }
    };

    const timeoutId = setTimeout(schedulePrefetch, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [enabled, delay, executePrefetch, prefetches.length]);

  const resetPrefetch = useCallback(() => {
    hasPrefetchedRef.current = false;
  }, []);

  return { resetPrefetch };
}

export function getTasksPrefetchConfigs(userId: string | undefined) {
  if (!userId) return [];

  const configs: PrefetchConfig[] = [
    {
      queryKey: ['/api/internal-tasks/assigned', userId, 'open', 'all'] as const,
      queryFn: async () => {
        const response = await fetch(`/api/internal-tasks/assigned/${userId}?status=open`, { 
          credentials: 'include' 
        });
        if (!response.ok) throw new Error('Failed to prefetch assigned tasks');
        return response.json();
      },
      staleTime: 30000,
    },
  ];

  return configs;
}
