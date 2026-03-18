import {
    HealthStatus,
    InsightCategory,
} from './enums';

// ─── Dashboard Overview ──────────────────────────────────────────────────────

export interface DashboardSummary {
    total: number;
    onTrack: number;
    atRisk: number;
    behind: number;
    notStarted: number;
    period: string;
}

export interface DashboardClientItem {
    id: string;
    name: string;
    industry: string;
    period: string;
    progress: number;
    healthScore: number;
    healthStatus: HealthStatus;
    daysRemaining: number;
    isOverdue: boolean;
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    pendingQuestions: number;
    preparer: { id: string; name: string; initials: string };
    reviewer: { id: string; name: string; initials: string };
}

export interface DashboardOverviewResponse {
    summary: DashboardSummary;
    clients: DashboardClientItem[];
}
