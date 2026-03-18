import { HealthStatus, CapacityStatus } from './enums';

export interface TeamMemberClientItem {
    id: string;
    name: string;
    healthStatus: HealthStatus;
}

export interface TeamMemberItem {
    id: string;
    name: string;
    role: string;
    initials: string;
    clientCount: number;
    capacityStatus: CapacityStatus;
    averageCloseTime: number;
    statusBreakdown: {
        onTrack: number;
        atRisk: number;
        behind: number;
        completed: number;
    };
    clients: TeamMemberClientItem[];
}

export interface RebalanceSuggestion {
    suggestion: string;
    fromMember: { id: string; name: string };
    toMember: { id: string; name: string };
    client: { id: string; name: string };
}

export interface TeamWorkloadResponse {
    period: string;
    summary: {
        totalMembers: number;
        totalActiveCloses: number;
        totalCompleted: number;
    };
    members: TeamMemberItem[];
    rebalanceSuggestions: RebalanceSuggestion[];
}
