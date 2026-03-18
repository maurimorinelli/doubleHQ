// ─── Create Client Request / Response ────────────────────────────────────────

export interface CreateClientRequest {
    name: string;
    industry: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    accountType: 'accrual' | 'cash';
    monthlyRevenue: number;
    fiscalYearEnd: number;           // 1-12
    qboConnected: boolean;
    notes?: string;
    templateId?: string;             // which close template to use (optional)
    closePeriod?: string;            // e.g. "2026-02" (optional)
}

export interface CreateClientResponse {
    clientId: string;
    closePeriodId: string | null;
    totalTasks: number;
    generatedTransactions: number;
}
