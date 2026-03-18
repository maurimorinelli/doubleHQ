/**
 * Factory functions for creating test entities.
 *
 * Each factory provides sensible defaults — tests only override what
 * matters for the scenario, keeping them readable and maintainable.
 */
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { FirmEntity } from '../../src/infrastructure/database/entities/firm.entity';
import { TeamMemberEntity } from '../../src/infrastructure/database/entities/team-member.entity';
import { ClientEntity } from '../../src/infrastructure/database/entities/client.entity';
import { ClosePeriodEntity } from '../../src/infrastructure/database/entities/close-period.entity';
import { CloseTaskEntity } from '../../src/infrastructure/database/entities/close-task.entity';
import { ImportedTransactionEntity } from '../../src/infrastructure/database/entities/imported-transaction.entity';
import { ReconciliationEntity } from '../../src/infrastructure/database/entities/reconciliation.entity';
import { JournalEntryEntity } from '../../src/infrastructure/database/entities/journal-entry.entity';
import { JournalEntryLineEntity } from '../../src/infrastructure/database/entities/journal-entry-line.entity';
import { CloseTemplateEntity } from '../../src/infrastructure/database/entities/close-template.entity';
import { TemplateSectionEntity } from '../../src/infrastructure/database/entities/template-section.entity';
import { TemplateTaskEntity } from '../../src/infrastructure/database/entities/template-task.entity';

// ─── Firm ────────────────────────────────────────────────────────────────────

export async function createFirm(ds: DataSource, overrides: Partial<FirmEntity> = {}): Promise<FirmEntity> {
    const repo = ds.getRepository(FirmEntity);
    return repo.save(repo.create({
        id: uuid(),
        name: 'Test Firm',
        plan: 'professional',
        timezone: 'America/New_York',
        ...overrides,
    }));
}

// ─── Team Member ─────────────────────────────────────────────────────────────

export async function createTeamMember(ds: DataSource, firmId: string, overrides: Partial<TeamMemberEntity> = {}): Promise<TeamMemberEntity> {
    const repo = ds.getRepository(TeamMemberEntity);
    return repo.save(repo.create({
        id: uuid(),
        firmId,
        name: 'Jane Doe',
        email: 'jane@test.com',
        role: 'preparer',
        avatarUrl: '',
        isActive: true,
        ...overrides,
    }));
}

// ─── Client ──────────────────────────────────────────────────────────────────

export async function createClient(ds: DataSource, firmId: string, preparerId: string, reviewerId: string, overrides: Partial<ClientEntity> = {}): Promise<ClientEntity> {
    const repo = ds.getRepository(ClientEntity);
    return repo.save(repo.create({
        id: uuid(),
        firmId,
        name: 'Acme Corp',
        industry: 'Technology',
        contactName: 'John Smith',
        contactEmail: 'john@acme.com',
        contactPhone: '555-0100',
        qboConnected: false,
        xeroConnected: false,
        monthlyRevenue: 50000,
        preparerId,
        reviewerId,
        accountType: 'accrual',
        fiscalYearEnd: 12,
        notes: '',
        ...overrides,
    }));
}

// ─── Close Template (Standard Monthly Close) ─────────────────────────────────

export interface TemplateTaskDef {
    title: string;
    description: string;
    autoCompleteRule: string | null;
    estimatedMinutes?: number;
}

export interface TemplateSectionDef {
    name: string;
    tasks: TemplateTaskDef[];
}

/**
 * Creates a close template with sections and tasks that mirror the
 * Standard Monthly Close workflow used in production.
 */
export async function createStandardTemplate(ds: DataSource, firmId: string): Promise<CloseTemplateEntity> {
    const templateRepo = ds.getRepository(CloseTemplateEntity);
    const sectionRepo = ds.getRepository(TemplateSectionEntity);
    const taskRepo = ds.getRepository(TemplateTaskEntity);

    const template = await templateRepo.save(templateRepo.create({
        id: uuid(),
        firmId,
        name: 'Standard Monthly Close',
        isDefault: true,
    }));

    const sections: TemplateSectionDef[] = [
        {
            name: 'Pre-Close',
            tasks: [
                { title: 'Import bank & credit card statements', description: 'Download and import all account statements', autoCompleteRule: null },
            ],
        },
        {
            name: 'Transaction Review',
            tasks: [
                { title: 'Code bank transactions', description: 'Categorize all checking account transactions', autoCompleteRule: 'all_transactions_categorized' },
                { title: 'Code credit card transactions', description: 'Categorize all credit card transactions', autoCompleteRule: 'all_cc_categorized' },
                { title: 'Review uncategorized transactions', description: 'Resolve remaining uncategorized items', autoCompleteRule: 'no_uncategorized_remaining' },
            ],
        },
        {
            name: 'Account Reconciliations',
            tasks: [
                { title: 'Reconcile checking account', description: 'Match book balance to bank statement', autoCompleteRule: 'checking_reconciled' },
                { title: 'Reconcile credit card', description: 'Match book balance to credit card statement', autoCompleteRule: 'cc_reconciled' },
            ],
        },
        {
            name: 'Adjusting Entries',
            tasks: [
                { title: 'Record depreciation', description: 'Post monthly depreciation entry', autoCompleteRule: 'depreciation_posted' },
                { title: 'Record accruals', description: 'Post accrual adjustments', autoCompleteRule: null },
            ],
        },
        {
            name: 'Review & Sign-off',
            tasks: [
                { title: 'Preparer review', description: 'Final check before reviewer sign-off', autoCompleteRule: null },
                { title: 'Manager sign-off', description: 'Manager reviews and approves the close', autoCompleteRule: 'sign_off' },
            ],
        },
    ];

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const sec = sections[sIdx];
        const section = await sectionRepo.save(sectionRepo.create({
            id: uuid(),
            templateId: template.id,
            name: sec.name,
            order: sIdx + 1,
        }));

        for (let tIdx = 0; tIdx < sec.tasks.length; tIdx++) {
            const task = sec.tasks[tIdx];
            await taskRepo.save(taskRepo.create({
                id: uuid(),
                sectionId: section.id,
                title: task.title,
                description: task.description,
                estimatedMinutes: task.estimatedMinutes ?? 30,
                order: tIdx + 1,
                autoCompleteRule: task.autoCompleteRule,
            }));
        }
    }

    // Re-read with relations loaded
    return templateRepo.findOne({
        where: { id: template.id },
        relations: ['sections', 'sections.tasks'],
    }) as Promise<CloseTemplateEntity>;
}

// ─── Close Period ────────────────────────────────────────────────────────────

export async function createClosePeriod(ds: DataSource, clientId: string, preparerId: string, reviewerId: string, overrides: Partial<ClosePeriodEntity> = {}): Promise<ClosePeriodEntity> {
    const repo = ds.getRepository(ClosePeriodEntity);
    return repo.save(repo.create({
        id: uuid(),
        clientId,
        period: '2026-02',
        status: 'in_progress',
        startDate: new Date('2026-03-01'),
        dueDate: new Date('2026-03-10'),
        completedDate: null,
        preparerId,
        reviewerId,
        totalTasks: 0,
        completedTasks: 0,
        blockedTasks: 0,
        healthScore: 100,
        healthStatus: 'on_track',
        previousCloseTime: 0,
        ...overrides,
    }));
}

// ─── Close Task ──────────────────────────────────────────────────────────────

export async function createCloseTask(ds: DataSource, closePeriodId: string, assigneeId: string, overrides: Partial<CloseTaskEntity> = {}): Promise<CloseTaskEntity> {
    const repo = ds.getRepository(CloseTaskEntity);
    return repo.save(repo.create({
        id: uuid(),
        closePeriodId,
        section: 'Transaction Review',
        sectionOrder: 1,
        title: 'Test Task',
        description: 'A test task',
        status: 'not_started',
        autoCompleteRule: null,
        assigneeId,
        dueDate: new Date('2026-03-10'),
        completedDate: null,
        blockedReason: null,
        order: 1,
        targetTab: 'overview',
        estimatedMinutes: 30,
        actualMinutes: null,
        ...overrides,
    }));
}

// ─── Imported Transaction ────────────────────────────────────────────────────

export async function createTransaction(ds: DataSource, closePeriodId: string, clientId: string, overrides: Partial<ImportedTransactionEntity> = {}): Promise<ImportedTransactionEntity> {
    const repo = ds.getRepository(ImportedTransactionEntity);
    return repo.save(repo.create({
        id: uuid(),
        closePeriodId,
        clientId,
        date: new Date('2026-02-15'),
        description: 'Test transaction',
        vendor: 'Test Vendor',
        amount: 100,
        type: 'debit',
        bankAccount: 'checking',
        importedCategory: null,
        finalCategory: null,
        status: 'uncategorized',
        aiSuggestedCategory: null,
        aiConfidence: null,
        reviewedBy: null,
        reviewedAt: null,
        isManual: false,
        ...overrides,
    }));
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export async function createReconciliation(ds: DataSource, closePeriodId: string, overrides: Partial<ReconciliationEntity> = {}): Promise<ReconciliationEntity> {
    const repo = ds.getRepository(ReconciliationEntity);
    return repo.save(repo.create({
        id: uuid(),
        closePeriodId,
        accountName: 'Business Checking',
        accountNumber: '1234',
        bookBalance: 15000.50,
        bankBalance: null,
        difference: 15000.50,
        status: 'not_started',
        reconciledBy: null,
        reconciledAt: null,
        notes: null,
        ...overrides,
    }));
}

// ─── Journal Entry ───────────────────────────────────────────────────────────

export async function createJournalEntry(ds: DataSource, closePeriodId: string, createdBy: string, overrides: Partial<JournalEntryEntity> = {}, lines?: Array<Partial<JournalEntryLineEntity>>): Promise<JournalEntryEntity> {
    const repo = ds.getRepository(JournalEntryEntity);
    const entryId = overrides.id ?? uuid();

    const defaultLines = (lines ?? [
        { accountName: 'Depreciation Expense', debit: 500, credit: null, description: null },
        { accountName: 'Accumulated Depreciation', debit: null, credit: 500, description: null },
    ]).map(l => ({
        id: l.id ?? uuid(),
        journalEntryId: entryId,
        accountName: l.accountName ?? 'Account',
        debit: l.debit ?? null,
        credit: l.credit ?? null,
        description: l.description ?? null,
        ...l,
    }));

    return repo.save(repo.create({
        id: entryId,
        closePeriodId,
        date: new Date('2026-02-28'),
        memo: 'Monthly depreciation',
        type: 'depreciation',
        status: 'draft',
        createdBy,
        postedAt: null,
        lines: defaultLines as JournalEntryLineEntity[],
        ...overrides,
    }));
}
