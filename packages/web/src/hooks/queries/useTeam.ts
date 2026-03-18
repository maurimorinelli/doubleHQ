import { useQuery } from '@tanstack/react-query';
import { fetchTeamWorkload, fetchTeamMembers, suggestAssignment, fetchInsights } from '../../api/client';

/** Query key factory for team data */
export const teamKeys = {
    all: ['team'] as const,
    workload: () => [...teamKeys.all, 'workload'] as const,
    members: () => [...teamKeys.all, 'members'] as const,
    suggestions: () => [...teamKeys.all, 'suggestions'] as const,
};

export const insightsKeys = {
    all: ['insights'] as const,
};

/** Team workload data */
export function useTeamWorkload() {
    return useQuery({
        queryKey: teamKeys.workload(),
        queryFn: fetchTeamWorkload,
    });
}

/** Team members list */
export function useTeamMembers() {
    return useQuery({
        queryKey: teamKeys.members(),
        queryFn: fetchTeamMembers,
    });
}

/** AI assignment suggestions */
export function useAssignmentSuggestions(enabled = true) {
    return useQuery({
        queryKey: teamKeys.suggestions(),
        queryFn: suggestAssignment,
        enabled,
        staleTime: 60_000, // 1min — suggestions don't change rapidly
    });
}

/** AI Insights */
export function useInsights() {
    return useQuery({
        queryKey: insightsKeys.all,
        queryFn: fetchInsights,
    });
}
