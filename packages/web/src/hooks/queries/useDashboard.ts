import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchDashboard } from '../../api/client';
import { useAppSelector } from '../../store/store';

/** Query key factory for dashboard */
export const dashboardKeys = {
    all: ['dashboard'] as const,
    overview: (filters: { status?: string[]; assignee?: string | null; sort?: string; period?: string | null }) =>
        [...dashboardKeys.all, 'overview', filters] as const,
};

/**
 * useDashboard — TanStack Query hook for dashboard data.
 * Reads filter state from Redux and builds the query key accordingly.
 * Uses keepPreviousData so filter changes don't flash loading state.
 */
export function useDashboard() {
    const filters = useAppSelector(s => s.dashboardFilters);

    return useQuery({
        queryKey: dashboardKeys.overview({
            status: filters.statusFilters.length > 0 ? filters.statusFilters : undefined,
            assignee: filters.assignee,
            sort: filters.sort,
            period: filters.period,
        }),
        queryFn: () => fetchDashboard({
            status: filters.statusFilters.length > 0 ? filters.statusFilters : undefined,
            assignee: filters.assignee ?? undefined,
            sort: filters.sort,
            period: filters.period ?? undefined,
        }),
        placeholderData: keepPreviousData,
    });
}
