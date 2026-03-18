// ─── Health & Status Enums ───────────────────────────────────────────────────

export enum HealthStatus {
    ON_TRACK = 'on_track',
    AT_RISK = 'at_risk',
    BEHIND = 'behind',
    NOT_STARTED = 'not_started',
}

export enum ClosePeriodStatus {
    NOT_STARTED = 'not_started',
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    REVIEW = 'review',
    CLOSED = 'closed',
}

export enum TaskStatus {
    NOT_STARTED = 'not_started',
    IN_PROGRESS = 'in_progress',
    COMPLETE = 'complete',
    BLOCKED = 'blocked',
}

// ─── Task Navigation ─────────────────────────────────────────────────────────
// Determines which UI tab a task row navigates to when clicked

export enum TaskTargetTab {
    OVERVIEW = 'overview',
    TRANSACTIONS = 'transactions',
    QUESTIONS = 'questions',
    RECONCILIATION = 'reconciliation',
    ADJUSTMENTS = 'adjustments',
    REVIEW = 'review',
}

// ─── Close Workflow Sections ─────────────────────────────────────────────────
// 5 sections × 11 tasks total — matches the Standard Monthly Close template

export enum CloseSection {
    PRE_CLOSE = 'Pre-Close',
    ACCOUNT_RECONCILIATIONS = 'Account Reconciliations',
    TRANSACTION_REVIEW = 'Transaction Review',
    ADJUSTING_ENTRIES = 'Adjusting Entries',
    REVIEW_SIGN_OFF = 'Review & Sign-off',
}

export const CLOSE_SECTION_LABELS: Record<CloseSection, string> = {
    [CloseSection.PRE_CLOSE]: 'Pre-Close',
    [CloseSection.ACCOUNT_RECONCILIATIONS]: 'Account Reconciliations',
    [CloseSection.TRANSACTION_REVIEW]: 'Transaction Review',
    [CloseSection.ADJUSTING_ENTRIES]: 'Adjusting Entries',
    [CloseSection.REVIEW_SIGN_OFF]: 'Review & Sign-off',
};

export const CLOSE_SECTION_ORDER: CloseSection[] = [
    CloseSection.PRE_CLOSE,
    CloseSection.ACCOUNT_RECONCILIATIONS,
    CloseSection.TRANSACTION_REVIEW,
    CloseSection.ADJUSTING_ENTRIES,
    CloseSection.REVIEW_SIGN_OFF,
];

// ─── Auto-Complete Rules ─────────────────────────────────────────────────────
// Tasks with these rules are completed by work done in other tabs

export enum AutoCompleteRule {
    ALL_TRANSACTIONS_CATEGORIZED = 'all_transactions_categorized',
    ALL_CC_CATEGORIZED = 'all_cc_categorized',
    CHECKING_RECONCILED = 'checking_reconciled',
    CC_RECONCILED = 'cc_reconciled',
    NO_UNCATEGORIZED_REMAINING = 'no_uncategorized_remaining',
    DEPRECIATION_POSTED = 'depreciation_posted',
    SIGN_OFF = 'sign_off',
}

// ─── Team Roles ──────────────────────────────────────────────────────────────

export enum TeamRole {
    PREPARER = 'preparer',
    REVIEWER = 'reviewer',
    MANAGER = 'manager',
    ADMIN = 'admin',
}

// ─── Client Questions ────────────────────────────────────────────────────────

export enum QuestionCategory {
    TRANSACTION_CLARIFICATION = 'transaction_clarification',
    MISSING_RECEIPT = 'missing_receipt',
    GENERAL = 'general',
}

export enum QuestionStatus {
    PENDING = 'pending',
    ANSWERED = 'answered',
    OVERDUE = 'overdue',
}

export enum QuestionPriority {
    NORMAL = 'normal',
    URGENT = 'urgent',
}

// ─── Imported Transactions ───────────────────────────────────────────────────

export enum TransactionStatus {
    CATEGORIZED = 'categorized',
    UNCATEGORIZED = 'uncategorized',
    FLAGGED = 'flagged',
    PENDING_CLIENT = 'pending_client',
}

export enum TransactionType {
    DEBIT = 'debit',
    CREDIT = 'credit',
}

/** System-defined transaction categories — the ONLY categories allowed.
 *  Both AI categorization and the UI dropdown MUST use these exact values. */
export const TRANSACTION_CATEGORIES = [
    'Office Supplies', 'Rent', 'Utilities', 'Professional Services', 'Travel',
    'Meals & Entertainment', 'Insurance', 'Software Subscriptions', 'Bank Fees',
    'Payroll', 'Marketing', 'Equipment', 'Maintenance', 'Postage & Shipping',
    'Telephone', 'Internet', 'Legal Fees', 'Accounting Fees', 'Revenue', 'COGS',
    'Miscellaneous',
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export enum BankAccountType {
    CHECKING = 'checking',
    CREDIT_CARD = 'credit_card',
}

// ─── Transaction Flags ───────────────────────────────────────────────────────

export enum FlagType {
    UNCATEGORIZED = 'uncategorized',
    MISSING_RECEIPT = 'missing_receipt',
    DUPLICATE = 'duplicate',
    UNUSUAL_AMOUNT = 'unusual_amount',
    LARGE = 'large',
    NEW_VENDOR = 'new_vendor',
    MISCLASSIFIED = 'misclassified',
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export enum ReconciliationStatus {
    NOT_STARTED = 'not_started',
    IN_PROGRESS = 'in_progress',
    RECONCILED = 'reconciled',
}

// ─── Journal Entries ─────────────────────────────────────────────────────────

export enum JournalEntryType {
    DEPRECIATION = 'depreciation',
    ADJUSTMENT = 'adjustment',
    RECURRING = 'recurring',
    CORRECTION = 'correction',
}

export enum JournalEntryStatus {
    DRAFT = 'draft',
    POSTED = 'posted',
    REVIEWED = 'reviewed',
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

export enum InsightCategory {
    URGENT = 'urgent',
    AT_RISK = 'at_risk',
    INSIGHT = 'insight',
    WIN = 'win',
}

// ─── Accounting ──────────────────────────────────────────────────────────────

export enum AccountType {
    ACCRUAL = 'accrual',
    CASH = 'cash',
}

// ─── Capacity ────────────────────────────────────────────────────────────────

export enum CapacityStatus {
    OVERLOADED = 'overloaded',
    MODERATE = 'moderate',
    BALANCED = 'balanced',
    AVAILABLE = 'available',
}
