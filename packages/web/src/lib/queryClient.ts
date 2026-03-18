import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,          // 30s — data considered fresh
            gcTime: 5 * 60_000,         // 5min — cache garbage collection
            retry: 1,                   // retry once on failure
            refetchOnWindowFocus: true,  // refetch stale data when user returns
            refetchOnReconnect: true,    // refetch after network reconnect
        },
        mutations: {
            retry: 0,                   // no retries on mutations
        },
    },
});
