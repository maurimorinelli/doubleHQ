import {
    TeamRole,
    ClosePeriodStatus,
    HealthStatus,
    TaskStatus,
    CloseSection,
    TaskTargetTab,
    AutoCompleteRule,
    QuestionStatus,
    QuestionCategory,
    FlagType,
    TransactionType,
    TransactionStatus,
    BankAccountType,
    ReconciliationStatus,
    JournalEntryType,
    JournalEntryStatus,
    AccountType,
} from '@doublehq/shared';

// ─── Domain Types ────────────────────────────────────────────────────────────
// Pure data shapes — no behaviour, no ORM decorators.
// Convention: use `type` for domain entities (see typescript_naming_conventions.md)

export type Firm = {
    id: string;
    name: string;
    plan: string;
    timezone: string;
    createdAt: Date;
};

export type TeamMember = {
    id: string;
    firmId: string;
    name: string;
    email: string;
    role: TeamRole;
    avatarUrl: string;
    isActive: boolean;
};

export type Client = {
    id: string;
    firmId: string;
    name: string;
    industry: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    qboConnected: boolean;
    xeroConnected: boolean;
    monthlyRevenue: number;
    preparerId: string;
    reviewerId: string;
    accountType: AccountType;
    fiscalYearEnd: number;
    createdAt: Date;
    notes: string;
};

export type ClosePeriod = {
    id: string;
    clientId: string;
    period: string;
    status: ClosePeriodStatus;
    startDate: Date;
    dueDate: Date;
    completedDate: Date | null;
    preparerId: string;
    reviewerId: string;
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    healthScore: number;
    healthStatus: HealthStatus;
    previousCloseTime: number;
    createdAt: Date;
    signedOffBy?: string | null;
    reviewNotes?: string | null;
};

export type CloseTask = {
    id: string;
    closePeriodId: string;
    section: CloseSection;
    sectionOrder: number;
    title: string;
    description: string;
    status: TaskStatus;
    autoCompleteRule: AutoCompleteRule | string | null;
    assigneeId: string;
    dueDate: Date;
    completedDate: Date | null;
    blockedReason: string | null;
    order: number;
    targetTab: TaskTargetTab;
    estimatedMinutes: number;
    actualMinutes: number | null;
};

export type ClientQuestion = {
    id: string;
    closePeriodId: string;
    clientId: string;
    question: string;
    category: QuestionCategory;
    transactionAmount: number;
    transactionDate: Date;
    transactionVendor: string;
    sentAt: Date;
    respondedAt: Date | null;
    response: string | null;
    status: QuestionStatus;
    remindersSent: number;
    lastReminderAt: Date | null;
};

export type TransactionFlag = {
    id: string;
    clientId: string;
    closePeriodId: string;
    transactionId?: string | null;
    type: FlagType;
    description: string;
    amount: number;
    transactionDate: Date;
    vendor: string;
    accountCoded: string | null;
    suggestedAccount: string | null;
    isResolved: boolean;
    resolvedAt: Date | null;
    resolvedBy: string | null;
    flaggedAt: Date;
};

export type CachedInsight = {
    id: string;
    firmId: string;
    insights: unknown;
    generatedAt: Date;
    expiresAt: Date;
    promptHash: string;
    model: string;
    tokenCount: number;
};

export type ImportedTransaction = {
    id: string;
    closePeriodId: string;
    clientId: string;
    date: Date;
    description: string;
    vendor: string;
    amount: number;
    type: TransactionType;
    bankAccount: BankAccountType;
    importedCategory: string | null;
    finalCategory: string | null;
    status: TransactionStatus;
    aiSuggestedCategory: string | null;
    aiConfidence: number | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    isManual: boolean;
};

export type Reconciliation = {
    id: string;
    closePeriodId: string;
    accountName: string;
    accountNumber: string;
    bookBalance: number;
    bankBalance: number | null;
    difference: number;
    status: ReconciliationStatus;
    reconciledBy: string | null;
    reconciledAt: Date | null;
    notes: string | null;
};

export type JournalEntry = {
    id: string;
    closePeriodId: string;
    date: Date;
    memo: string;
    type: JournalEntryType;
    status: JournalEntryStatus;
    createdBy: string;
    postedAt: Date | null;
    lines?: JournalEntryLine[];
};

export type JournalEntryLine = {
    id: string;
    journalEntryId: string;
    accountName: string;
    debit: number | null;
    credit: number | null;
    description: string | null;
};

// ─── Template types ──────────────────────────────────────────────────────────

export type CloseTemplate = {
    id: string;
    firmId: string;
    name: string;
    isDefault: boolean;
    sections?: TemplateSection[];
};

export type TemplateSection = {
    id: string;
    templateId: string;
    name: string;
    order: number;
    tasks?: TemplateTask[];
};

export type TemplateTask = {
    id: string;
    sectionId: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    order: number;
    autoCompleteRule: AutoCompleteRule | string | null;
};

// ─── Relation types ──────────────────────────────────────────────────────────
// Used when repositories join related entities (e.g. closePeriod.client)

export type ClosePeriodWithRelations = ClosePeriod & {
    client?: Client;
    preparer?: TeamMember;
    reviewer?: TeamMember;
};

export type CloseTaskWithRelations = CloseTask & {
    assignee?: TeamMember;
};

export type JournalEntryWithRelations = JournalEntry & {
    creator?: TeamMember;
};
