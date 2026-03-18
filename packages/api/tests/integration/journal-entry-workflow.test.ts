/**
 * Journal Entry Workflow — Integration Tests
 *
 * Journal entries are how accountants record adjustments (depreciation,
 * accruals, corrections) during the close. A posted depreciation entry
 * auto-completes the "Record depreciation" task.
 *
 * Business rules tested:
 *   1. Creating a journal entry persists lines with correct debits/credits
 *   2. Posting a balanced depreciation entry auto-completes the depreciation task
 *   3. Posting an unbalanced entry fails with clear error
 *   4. Task counts on close period are updated after posting
 */
import { DataSource } from 'typeorm';
import { createTestDataSource, clearAll, stopContainer } from '../helpers/test-datasource';
import { createFirm, createTeamMember, createClient, createClosePeriod, createCloseTask, createJournalEntry } from '../helpers/factories';
import { CreateJournalEntryUseCase, PostJournalEntryUseCase } from '../../src/application/use-cases/journal-entry';
import {
    TypeOrmJournalEntryRepository,
    TypeOrmCloseTaskRepository,
    TypeOrmClosePeriodRepository,
} from '../../src/infrastructure/database/repositories';

let ds: DataSource;

beforeAll(async () => {
    ds = await createTestDataSource();
});

afterAll(async () => {
    await stopContainer();
});

afterEach(async () => {
    await clearAll(ds);
});

describe('Journal Entry Workflow', () => {

    async function setup() {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id);
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Reviewer', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id);
        const closePeriod = await createClosePeriod(ds, client.id, preparer.id, reviewer.id, { totalTasks: 2 });
        return { firm, preparer, reviewer, client, closePeriod };
    }

    // ─── Creating a journal entry persists lines ─────────────────────────────

    it('creating a journal entry saves lines with correct debits/credits', async () => {
        const { client, closePeriod } = await setup();

        const uc = new CreateJournalEntryUseCase(
            new TypeOrmJournalEntryRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
        );

        const result = await uc.execute(client.id, {
            closePeriodId: closePeriod.id,
            memo: 'Monthly depreciation for February',
            type: 'depreciation',
            date: '2026-02-28',
            lines: [
                { accountName: 'Depreciation Expense', debit: 1200, credit: 0 },
                { accountName: 'Accumulated Depreciation', debit: 0, credit: 1200 },
            ],
        });

        expect(result.entryId).toBeDefined();

        // Verify the entry was saved with correct lines
        const jeRepo = new TypeOrmJournalEntryRepository(ds);
        const entry = await jeRepo.findById(result.entryId);
        expect(entry).not.toBeNull();
        expect(entry!.status).toBe('draft');
        expect(entry!.memo).toBe('Monthly depreciation for February');
        expect(entry!.lines).toHaveLength(2);

        const debitLine = entry!.lines!.find((l: any) => (l.debit ?? 0) > 0);
        const creditLine = entry!.lines!.find((l: any) => (l.credit ?? 0) > 0);
        expect(Number(debitLine!.debit)).toBe(1200);
        expect(Number(creditLine!.credit)).toBe(1200);
    });

    // ─── Posting depreciation entry auto-completes the task ──────────────────

    it('posting a balanced depreciation entry auto-completes the depreciation task', async () => {
        const { closePeriod, preparer } = await setup();

        // Create the auto-complete task for depreciation
        const depTask = await createCloseTask(ds, closePeriod.id, preparer.id, {
            title: 'Record depreciation',
            autoCompleteRule: 'depreciation_posted',
            section: 'Adjusting Entries',
        });

        // Create a balanced depreciation entry
        const entry = await createJournalEntry(ds, closePeriod.id, preparer.id, {
            type: 'depreciation',
        });

        const uc = new PostJournalEntryUseCase(
            new TypeOrmJournalEntryRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
        );

        const result = await uc.execute(entry.id);
        expect(result.posted).toBe(true);

        // Depreciation task should be auto-completed
        const updatedTask = await new TypeOrmCloseTaskRepository(ds).findById(depTask.id);
        expect(updatedTask!.status).toBe('complete');
    });

    // ─── Unbalanced entry fails ──────────────────────────────────────────────

    it('posting an unbalanced entry fails with clear error', async () => {
        const { closePeriod, preparer } = await setup();

        // Create an unbalanced entry (debits ≠ credits)
        const entry = await createJournalEntry(ds, closePeriod.id, preparer.id, {}, [
            { accountName: 'Rent Expense', debit: 3000, credit: null, description: null },
            { accountName: 'Cash', debit: null, credit: 2500, description: null },
        ]);

        const uc = new PostJournalEntryUseCase(
            new TypeOrmJournalEntryRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
        );

        await expect(uc.execute(entry.id)).rejects.toThrow('Entry not balanced');
    });

    // ─── Task counts update after posting ────────────────────────────────────

    it('task counts on close period are updated after posting', async () => {
        const { closePeriod, preparer, client } = await setup();

        await createCloseTask(ds, closePeriod.id, preparer.id, {
            title: 'Record depreciation',
            autoCompleteRule: 'depreciation_posted',
        });
        await createCloseTask(ds, closePeriod.id, preparer.id, {
            title: 'Manual review',
            autoCompleteRule: null,
        });

        await new TypeOrmClosePeriodRepository(ds).updateTaskCounts(closePeriod.id, 0, 2);

        const entry = await createJournalEntry(ds, closePeriod.id, preparer.id, { type: 'depreciation' });

        const uc = new PostJournalEntryUseCase(
            new TypeOrmJournalEntryRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
        );

        await uc.execute(entry.id);

        const cp = await new TypeOrmClosePeriodRepository(ds).findByClientId(client.id);
        expect(cp[0].completedTasks).toBe(1);
        expect(cp[0].totalTasks).toBe(2);
    });
});
