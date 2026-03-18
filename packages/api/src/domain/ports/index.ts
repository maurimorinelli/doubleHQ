import {
    Client, Firm, ClosePeriod, ClosePeriodWithRelations, CloseTask, CloseTaskWithRelations,
    ClientQuestion, TransactionFlag, TeamMember, CachedInsight,
    ImportedTransaction, Reconciliation, JournalEntry, JournalEntryWithRelations,
    CloseTemplate,
} from '../entities';

export interface ClientRepository {
    findAllByFirmId(firmId: string): Promise<Client[]>;
    findById(id: string): Promise<Client | null>;
    save(client: Omit<Client, 'createdAt'>): Promise<Client>;
}

export interface ClosePeriodRepository {
    findActiveByFirmId(firmId: string, period?: string): Promise<ClosePeriodWithRelations[]>;
    findByClientId(clientId: string, limit?: number): Promise<ClosePeriod[]>;
    findLatestByClientId(clientId: string): Promise<ClosePeriodWithRelations | null>;
    findById(id: string): Promise<ClosePeriodWithRelations | null>;
    updateHealthScore(id: string, score: number, status: string): Promise<void>;
    save(period: Omit<ClosePeriod, 'createdAt'>): Promise<ClosePeriod>;
    updateTaskCounts(id: string, completed: number, total: number): Promise<void>;
    updateSignoff(id: string, signedOffBy: string, reviewNotes: string): Promise<void>;
    updateAssignment(id: string, preparerId: string, reviewerId: string): Promise<void>;
}

export interface CloseTaskRepository {
    findByClosePeriodId(closePeriodId: string): Promise<CloseTaskWithRelations[]>;
    findById(id: string): Promise<CloseTask | null>;
    updateStatus(id: string, status: string, completedDate: Date | null): Promise<void>;
    saveBatch(tasks: CloseTask[]): Promise<void>;
    reassignByClosePeriod(closePeriodId: string, oldAssigneeId: string, newAssigneeId: string): Promise<number>;
}

export interface ClientQuestionRepository {
    findByClosePeriodId(closePeriodId: string): Promise<ClientQuestion[]>;
    findByClientId(clientId: string): Promise<ClientQuestion[]>;
    findPendingByFirmId(firmId: string, period: string): Promise<ClientQuestion[]>;
    save(question: Omit<ClientQuestion, 'respondedAt' | 'response' | 'remindersSent' | 'lastReminderAt'>): Promise<ClientQuestion>;
    resolve(id: string, response: string): Promise<void>;
}

export interface TransactionFlagRepository {
    findByClosePeriodId(closePeriodId: string): Promise<TransactionFlag[]>;
    findUnresolvedByClientId(clientId: string, closePeriodId: string): Promise<TransactionFlag[]>;
    saveBatch(flags: TransactionFlag[]): Promise<void>;
    deleteByClosePeriodId(closePeriodId: string): Promise<void>;
    resolveByVendorAndAmount(clientId: string, vendor: string, amount: number): Promise<number>;
    resolveByTransactionId(clientId: string, transactionId: string): Promise<number>;
}

export interface TeamMemberRepository {
    findByFirmId(firmId: string): Promise<TeamMember[]>;
    findById(id: string): Promise<TeamMember | null>;
    save(member: Omit<TeamMember, 'isActive'>): Promise<TeamMember>;
}

export interface CachedInsightRepository {
    findLatestByFirmId(firmId: string): Promise<CachedInsight | null>;
    save(insight: Omit<CachedInsight, 'id'>): Promise<CachedInsight>;
}

export interface InsightGenerator {
    generate(prompt: string): Promise<{ insights: unknown[]; tokenCount: number }>;
}

export interface ImportedTransactionRepository {
    findByClosePeriodId(closePeriodId: string): Promise<ImportedTransaction[]>;
    findById(id: string): Promise<ImportedTransaction | null>;
    updateCategory(id: string, category: string, status: string): Promise<void>;
    countByClosePeriodAndStatus(closePeriodId: string, bankAccount: string): Promise<{ total: number; categorized: number }>;
    updateAllWithAiSuggestions(closePeriodId: string): Promise<number>;
    saveBatch(txns: ImportedTransaction[]): Promise<void>;
    updateBulkAiSuggestions(updates: Array<{ id: string; aiSuggestedCategory: string; aiConfidence: number }>): Promise<number>;
    updateAmount(id: string, amount: number): Promise<void>;
    deleteById(id: string): Promise<void>;
    saveOne(txn: ImportedTransaction): Promise<ImportedTransaction>;
    sumByClosePeriodAndAccount(closePeriodId: string): Promise<Array<{ bankAccount: string; total: number }>>;
}

export interface ReconciliationRepository {
    findByClosePeriodId(closePeriodId: string): Promise<Reconciliation[]>;
    findById(id: string): Promise<Reconciliation | null>;
    update(id: string, data: Partial<Reconciliation>): Promise<void>;
    saveBatch(recs: Reconciliation[]): Promise<void>;
}

export interface JournalEntryRepository {
    findByClosePeriodId(closePeriodId: string): Promise<JournalEntryWithRelations[]>;
    findById(id: string): Promise<JournalEntry | null>;
    save(entry: Partial<JournalEntry>): Promise<JournalEntry>;
    updateStatus(id: string, status: string, postedAt: Date | null): Promise<void>;
}

export interface CloseTemplateRepository {
    findByFirmId(firmId: string): Promise<CloseTemplate[]>;
    findById(id: string): Promise<CloseTemplate | null>;
}

// ─── Auth-specific types ─────────────────────────────────────────────────────

/** TeamMember with auth-specific fields (passwordHash, firm name). */
export type TeamMemberWithAuth = {
    id: string;
    firmId: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string;
    isActive: boolean;
    passwordHash: string | null;
    firmName: string | null;
};

// ─── Auth Repository ─────────────────────────────────────────────────────────

export interface AuthRepository {
    findByEmail(email: string): Promise<TeamMemberWithAuth | null>;
    findByIdWithFirm(id: string): Promise<TeamMemberWithAuth | null>;
    createWithPassword(
        member: Omit<TeamMemberWithAuth, 'passwordHash' | 'firmName'>,
        passwordHash: string,
    ): Promise<TeamMemberWithAuth>;
}

// ─── Firm Repository ─────────────────────────────────────────────────────────

export interface FirmRepository {
    save(firm: Omit<Firm, 'createdAt'>): Promise<Firm>;
}
