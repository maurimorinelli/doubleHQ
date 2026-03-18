import { z } from 'zod';

// ─── Reusable Primitives ─────────────────────────────────────────────────────

const uuid = z.string().uuid('Must be a valid UUID');
const requiredString = z.string().min(1, 'Cannot be empty');
const optionalString = z.string().optional();
const email = z.string().email('Must be a valid email address');
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be a period in YYYY-MM format');

// ─── Create Client ──────────────────────────────────────────────────────────

export const CreateClientSchema = z.object({
    name: requiredString,
    industry: optionalString,
    contactName: optionalString,
    contactEmail: z.string().email().optional().or(z.literal('')),
    monthlyRevenue: z.number().min(0).optional(),
    accountingSystem: z.enum(['quickbooks', 'xero', 'sage', 'wave', 'other']).optional(),
    startClose: z.boolean().optional(),
});

// ─── Start Close ────────────────────────────────────────────────────────────

export const StartCloseSchema = z.object({
    templateId: requiredString,
    period: period,
    preparerId: z.string().optional(),
    reviewerId: z.string().optional(),
});

// ─── Update Task Status ─────────────────────────────────────────────────────

export const UpdateTaskStatusSchema = z.object({
    status: z.enum(['not_started', 'in_progress', 'complete', 'blocked']),
});

// ─── Categorize Transaction ─────────────────────────────────────────────────

export const CategorizeTransactionSchema = z.object({
    finalCategory: requiredString,
});

// ─── ClosePeriodId-only body ────────────────────────────────────────────────

export const ClosePeriodIdSchema = z.object({
    closePeriodId: requiredString,
});

// ─── Manual Flag ────────────────────────────────────────────────────────────

export const ManualFlagSchema = z.object({
    reason: z.string().optional(),
});

// ─── Ask Client Question ────────────────────────────────────────────────────

export const AskClientQuestionSchema = z.object({
    question: requiredString,
    category: optionalString,
});

// ─── Resolve Question ───────────────────────────────────────────────────────

export const ResolveQuestionSchema = z.object({
    response: requiredString,
});

// ─── Reconcile Account ──────────────────────────────────────────────────────

export const ReconcileAccountSchema = z.object({
    bankBalance: z.number({ message: 'bankBalance must be a number' }),
    notes: optionalString,
});

// ─── Adjust Transaction Amount ──────────────────────────────────────────────

export const AdjustAmountSchema = z.object({
    amount: z.number({ message: 'amount must be a number' }),
});

// ─── Add Manual Transaction ─────────────────────────────────────────────────

export const AddManualTransactionSchema = z.object({
    closePeriodId: requiredString,
    date: requiredString,
    description: z.string().default(''),
    vendor: z.string().default(''),
    amount: z.number({ message: 'amount must be a number' }),
    type: z.enum(['debit', 'credit']).default('debit'),
    bankAccount: z.string().default('checking'),
});

// ─── Create Journal Entry ───────────────────────────────────────────────────

export const JournalEntryLineSchema = z.object({
    accountName: requiredString,
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
    description: z.string().default(''),
});

export const CreateJournalEntrySchema = z.object({
    closePeriodId: requiredString,
    memo: requiredString,
    type: z.enum(['adjustment', 'correction', 'recurring', 'depreciation']),
    date: requiredString,
    lines: z.array(JournalEntryLineSchema).min(2, 'Journal entry must have at least 2 lines'),
});

// ─── Sign Off Close ─────────────────────────────────────────────────────────

export const SignOffCloseSchema = z.object({
    reviewNotes: z.string().default(''),
});

// ─── Create Team Member ─────────────────────────────────────────────────────

export const CreateTeamMemberSchema = z.object({
    name: requiredString,
    email: email,
    role: z.enum(['preparer', 'reviewer', 'manager']),
});

// ─── Reassign Close ─────────────────────────────────────────────────────────

export const ReassignCloseSchema = z.object({
    preparerId: requiredString,
    reviewerId: requiredString,
});

// ─── Dashboard Query ────────────────────────────────────────────────────────

export const DashboardQuerySchema = z.object({
    period: z.string().optional(),
    status: z.string().optional(),
    assignee: z.string().optional(),
    sort: z.string().optional(),
});
