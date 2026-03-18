import {
    HealthStatus,
    TaskStatus,
    TaskTargetTab,
    CloseSection,
    QuestionStatus,
    FlagType,
} from './enums';

// ─── Client Close Detail ─────────────────────────────────────────────────────

export interface ClientInfo {
    id: string;
    name: string;
    industry: string;
    contactName: string;
    contactEmail: string;
    qboConnected: boolean;
}

export interface ClosePeriodInfo {
    id: string;
    period: string;
    status: string;
    healthScore: number;
    healthStatus: HealthStatus;
    dueDate: string;
    daysRemaining: number;
    progress: number;
    preparerId: string;
    reviewerId: string;
    preparerName: string;
    reviewerName: string;
}

export interface TaskItem {
    id: string;
    title: string;
    status: TaskStatus;
    autoCompleteRule: string | null;
    sectionOrder: number;
    assignee: string;
    blockedReason: string | null;
    targetTab: TaskTargetTab;
}

export interface WorkflowSectionData {
    name: CloseSection;
    label: string;
    totalTasks: number;
    completedTasks: number;
    isBlocked: boolean;
    blockedReason?: string;
    tasks: TaskItem[];
}

export interface RiskFactor {
    riskLevel: 'low' | 'medium' | 'medium_high' | 'high' | 'critical';
    summary: string;
    factors: string[];
    recommendation: string;
}

export interface CommunicationEntry {
    date: string;
    type: 'questions_sent' | 'reminder' | 'client_response' | 'no_response' | 'note';
    text: string;
}

export interface ClientCloseDetailResponse {
    client: ClientInfo;
    closePeriod: ClosePeriodInfo | null;
    sections: WorkflowSectionData[];
    riskAssessment: RiskFactor | null;
    communications: CommunicationEntry[];
}
