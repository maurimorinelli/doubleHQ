// ─── AI Data Generator Port ──────────────────────────────────────────────────
// Generates realistic accounting data for new clients via AI

export interface GeneratedTransaction {
    date: string;          // ISO date
    description: string;
    vendor: string;
    amount: number;
    type: 'debit' | 'credit';
    bankAccount: 'checking' | 'credit_card';
}

export interface AiDataGenerator {
    generateClientData(context: {
        clientName: string;
        industry: string;
        monthlyRevenue: number;
        accountType: string;
        period: string;      // e.g. "2026-02"
    }): Promise<{
        transactions: GeneratedTransaction[];
    }>;
}
