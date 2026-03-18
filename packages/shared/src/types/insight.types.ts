import { InsightCategory } from './enums';

export interface InsightMetrics {
    [key: string]: string | number | boolean;
}

export interface InsightItem {
    id: string;
    category: InsightCategory;
    title: string;
    description: string;
    affectedClient: { id: string; name: string } | null;
    affectedTeamMember: { id: string; name: string } | null;
    recommendedAction: string;
    metrics: InsightMetrics;
}

export interface InsightsResponse {
    lastUpdated: string;
    source: 'ai' | 'template';
    insights: InsightItem[];
}
