import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Helper to check if error is a server restart/unavailable error
function isServerUnavailableError(error: any): boolean {
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return true;
  }
  if (error?.message?.includes('502') || error?.message?.includes('503')) {
    return true;
  }
  if (error?.message?.includes('ECONNREFUSED') || error?.message?.includes('Network request failed')) {
    return true;
  }
  return false;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null;
  }
  
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL with proper query parameters
    let url = queryKey[0] as string;
    
    // If there are query parameters (object in queryKey[1]), append them as query string
    if (queryKey.length > 1 && typeof queryKey[1] === 'object' && queryKey[1] !== null) {
      const params = new URLSearchParams();
      const queryParams = queryKey[1] as Record<string, any>;
      
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    } else if (queryKey.length > 1) {
      // Fallback to original join behavior for non-object query keys
      url = queryKey.join("/");
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // Disable automatic refetch on focus to reduce server load
      refetchOnReconnect: true, // Refetch when network reconnects
      staleTime: 30000, // Data stays fresh for 30 seconds to reduce duplicate requests
      // Smart retry logic: retry on server errors, but not on client errors
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx except 401 which might be session timeout)
        if (error?.message?.includes('400') ||
            error?.message?.includes('403') ||
            error?.message?.includes('404')) {
          return false;
        }

        // Retry on server unavailable errors (server restart scenario)
        if (isServerUnavailableError(error)) {
          return failureCount < 5; // Retry up to 5 times for server errors
        }

        // Retry on 401 (might be session expired during server restart)
        if (error?.message?.includes('401')) {
          return failureCount < 2; // Retry twice for auth errors
        }

        // Don't retry other errors
        return false;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        return Math.min(1000 * 2 ** attemptIndex, 16000);
      },
    },
    mutations: {
      // Retry mutations only on server unavailable errors
      retry: (failureCount, error) => {
        if (isServerUnavailableError(error)) {
          return failureCount < 3; // Retry up to 3 times
        }
        return false;
      },
      retryDelay: (attemptIndex) => {
        return Math.min(1000 * 2 ** attemptIndex, 8000);
      },
    },
  },
});
