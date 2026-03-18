import {
    TransactionStatus,
    TransactionType,
    BankAccountType,
    ReconciliationStatus,
    JournalEntryType,
    JournalEntryStatus,
} from './enums';

// ─── Imported Transactions ───────────────────────────────────────────────────

export interface TransactionItem {
    id: string;
    date: string;
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
    isManual: boolean;
}

export interface TransactionSummary {
    total: number;
    categorized: number;
    uncategorized: number;
    flagged: number;
    pendingClient: number;
}

export interface ReconciliationSummaryByAccount {
    bankAccount: string;
    accountLabel: string;
    bookBalance: number;
    bankBalance: number | null;
    difference: number;
    status: string;
}

export interface ClientTransactionsResponse {
    summary: TransactionSummary;
    transactions: TransactionItem[];
    reconciliationSummary: ReconciliationSummaryByAccount[];
}

// ─── Reconciliations ─────────────────────────────────────────────────────────

export interface ReconciliationCard {
    id: string;
    accountName: string;
    accountNumber: string;
    bookBalance: number;
    bankBalance: number | null;
    difference: number;
    status: ReconciliationStatus;
    reconciledBy: string | null;
    reconciledAt: string | null;
    notes: string | null;
}

export interface ClientReconciliationsResponse {
    reconciliations: ReconciliationCard[];
}

// ─── Journal Entries ─────────────────────────────────────────────────────────

export interface JournalEntryLineItem {
    id: string;
    accountName: string;
    debit: number | null;
    credit: number | null;
    description: string | null;
}

export interface JournalEntryItem {
    id: string;
    date: string;
    memo: string;
    type: JournalEntryType;
    status: JournalEntryStatus;
    createdBy: string;
    postedAt: string | null;
    lines: JournalEntryLineItem[];
}

export interface ClientJournalEntriesResponse {
    entries: JournalEntryItem[];
}
