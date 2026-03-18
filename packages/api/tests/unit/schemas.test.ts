/**
 * Zod Validation Schemas — Unit Tests
 *
 * Tests edge cases for request validation schemas.
 * Each schema is tested for:
 *   - Valid input passes
 *   - Missing required fields fail
 *   - Invalid types fail
 *   - Edge cases (empty strings, negative numbers, boundary values)
 */
import {
    CreateClientSchema,
    StartCloseSchema,
    UpdateTaskStatusSchema,
    CategorizeTransactionSchema,
    ReconcileAccountSchema,
    CreateJournalEntrySchema,
    CreateTeamMemberSchema,
    AddManualTransactionSchema,
    ReassignCloseSchema,
    AskClientQuestionSchema,
    DashboardQuerySchema,
} from '../../src/presentation/validation/schemas';

// ═══════════════════════════════════════════════════════════════════════════════
// CreateClientSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('CreateClientSchema', () => {
    it('accepts valid input with required fields only', () => {
        const result = CreateClientSchema.safeParse({ name: 'Acme Corp' });
        expect(result.success).toBe(true);
    });

    it('accepts valid input with all optional fields', () => {
        const result = CreateClientSchema.safeParse({
            name: 'Acme Corp',
            industry: 'Technology',
            contactName: 'Jane Doe',
            contactEmail: 'jane@acme.com',
            monthlyRevenue: 50000,
            accountingSystem: 'quickbooks',
            startClose: true,
        });
        expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
        const result = CreateClientSchema.safeParse({ name: '' });
        expect(result.success).toBe(false);
    });

    it('rejects missing name', () => {
        const result = CreateClientSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('rejects invalid accounting system', () => {
        const result = CreateClientSchema.safeParse({
            name: 'Acme',
            accountingSystem: 'invalid_system',
        });
        expect(result.success).toBe(false);
    });

    it('accepts empty string for contactEmail', () => {
        const result = CreateClientSchema.safeParse({
            name: 'Acme',
            contactEmail: '',
        });
        expect(result.success).toBe(true);
    });

    it('rejects negative monthly revenue', () => {
        const result = CreateClientSchema.safeParse({
            name: 'Acme',
            monthlyRevenue: -1000,
        });
        expect(result.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// StartCloseSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('StartCloseSchema', () => {
    it('accepts valid close start', () => {
        const result = StartCloseSchema.safeParse({
            templateId: 'tmpl-001',
            period: '2026-03',
        });
        expect(result.success).toBe(true);
    });

    it('rejects invalid period format (MM-YYYY)', () => {
        const result = StartCloseSchema.safeParse({
            templateId: 'tmpl-001',
            period: '03-2026',
        });
        expect(result.success).toBe(false);
    });

    it('rejects invalid month (13)', () => {
        const result = StartCloseSchema.safeParse({
            templateId: 'tmpl-001',
            period: '2026-13',
        });
        expect(result.success).toBe(false);
    });

    it('rejects empty templateId', () => {
        const result = StartCloseSchema.safeParse({
            templateId: '',
            period: '2026-03',
        });
        expect(result.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CreateJournalEntrySchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('CreateJournalEntrySchema', () => {
    const validEntry = {
        closePeriodId: 'cp-001',
        memo: 'Monthly depreciation',
        type: 'depreciation',
        date: '2026-03-01',
        lines: [
            { accountName: 'Depreciation Expense', debit: 833, credit: 0 },
            { accountName: 'Accumulated Depreciation', debit: 0, credit: 833 },
        ],
    };

    it('accepts valid balanced entry', () => {
        const result = CreateJournalEntrySchema.safeParse(validEntry);
        expect(result.success).toBe(true);
    });

    it('rejects entry with less than 2 lines', () => {
        const result = CreateJournalEntrySchema.safeParse({
            ...validEntry,
            lines: [{ accountName: 'X', debit: 100, credit: 0 }],
        });
        expect(result.success).toBe(false);
    });

    it('rejects entry with invalid type', () => {
        const result = CreateJournalEntrySchema.safeParse({
            ...validEntry,
            type: 'invalid_type',
        });
        expect(result.success).toBe(false);
    });

    it('rejects entry with empty memo', () => {
        const result = CreateJournalEntrySchema.safeParse({
            ...validEntry,
            memo: '',
        });
        expect(result.success).toBe(false);
    });

    it('rejects negative debit/credit amounts', () => {
        const result = CreateJournalEntrySchema.safeParse({
            ...validEntry,
            lines: [
                { accountName: 'A', debit: -100, credit: 0 },
                { accountName: 'B', debit: 0, credit: 100 },
            ],
        });
        expect(result.success).toBe(false);
    });

    it('accepts entry with empty accountName in line → fails', () => {
        const result = CreateJournalEntrySchema.safeParse({
            ...validEntry,
            lines: [
                { accountName: '', debit: 100, credit: 0 },
                { accountName: 'B', debit: 0, credit: 100 },
            ],
        });
        expect(result.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ReconcileAccountSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('ReconcileAccountSchema', () => {
    it('accepts valid bank balance', () => {
        const result = ReconcileAccountSchema.safeParse({ bankBalance: 15234.56 });
        expect(result.success).toBe(true);
    });

    it('accepts zero balance', () => {
        const result = ReconcileAccountSchema.safeParse({ bankBalance: 0 });
        expect(result.success).toBe(true);
    });

    it('accepts negative balance', () => {
        const result = ReconcileAccountSchema.safeParse({ bankBalance: -500 });
        expect(result.success).toBe(true);
    });

    it('rejects string for bankBalance', () => {
        const result = ReconcileAccountSchema.safeParse({ bankBalance: '15234.56' });
        expect(result.success).toBe(false);
    });

    it('rejects missing bankBalance', () => {
        const result = ReconcileAccountSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CreateTeamMemberSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('CreateTeamMemberSchema', () => {
    it('accepts valid team member', () => {
        const result = CreateTeamMemberSchema.safeParse({
            name: 'Jordan Kim',
            email: 'jordan@firm.com',
            role: 'preparer',
        });
        expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
        const result = CreateTeamMemberSchema.safeParse({
            name: 'Jordan Kim',
            email: 'not-an-email',
            role: 'preparer',
        });
        expect(result.success).toBe(false);
    });

    it('rejects invalid role', () => {
        const result = CreateTeamMemberSchema.safeParse({
            name: 'Jordan Kim',
            email: 'jordan@firm.com',
            role: 'admin', // not in enum
        });
        expect(result.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UpdateTaskStatusSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('UpdateTaskStatusSchema', () => {
    it.each(['not_started', 'in_progress', 'complete', 'blocked'] as const)(
        'accepts valid status: %s',
        (status) => {
            expect(UpdateTaskStatusSchema.safeParse({ status }).success).toBe(true);
        }
    );

    it('rejects invalid status', () => {
        expect(UpdateTaskStatusSchema.safeParse({ status: 'done' }).success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DashboardQuerySchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('DashboardQuerySchema', () => {
    it('accepts empty object (all optional)', () => {
        expect(DashboardQuerySchema.safeParse({}).success).toBe(true);
    });

    it('accepts all params', () => {
        expect(DashboardQuerySchema.safeParse({
            period: '2026-03',
            status: 'on_track',
            assignee: 'member-1',
            sort: 'health_asc',
        }).success).toBe(true);
    });
});
