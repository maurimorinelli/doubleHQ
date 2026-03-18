/**
 * Client Questions & Manual Task Status — Integration Tests
 *
 * Client questions: When an accountant asks a client about a transaction,
 * the transaction status changes to "pending_client", blocking categorization
 * auto-complete until the client responds.
 *
 * Manual task status: The "Mark as done" button syncs close period task
 * counts so the progress bar stays accurate.
 *
 * Business rules tested:
 *   1. Asking a transaction question changes status to "pending_client"
 *   2. Generic questions (not tied to a transaction) are supported
 *   3. Manual task completion updates close period counts
 *   4. Marking a task as incomplete reduces the completed count
 */
import { DataSource } from 'typeorm';
import { createTestDataSource, clearAll, stopContainer } from '../helpers/test-datasource';
import { createFirm, createTeamMember, createClient, createClosePeriod, createCloseTask, createTransaction } from '../helpers/factories';
import { AskClientQuestionUseCase } from '../../src/application/use-cases/ask-client-question';
import { UpdateCloseTaskStatusUseCase } from '../../src/application/use-cases/get-client-detail-tab-data';
import {
    TypeOrmImportedTransactionRepository,
    TypeOrmCloseTaskRepository,
    TypeOrmClosePeriodRepository,
    TypeOrmClientQuestionRepository,
} from '../../src/infrastructure/database/repositories';

let ds: DataSource;

beforeAll(async () => { ds = await createTestDataSource(); });
afterAll(async () => { await stopContainer(); });
afterEach(async () => { await clearAll(ds); });

describe('Client Questions', () => {

    async function setup() {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id);
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Reviewer', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id);
        const closePeriod = await createClosePeriod(ds, client.id, preparer.id, reviewer.id);
        return { firm, preparer, client, closePeriod };
    }

    function createQuestionUseCase() {
        return new AskClientQuestionUseCase(
            new TypeOrmClientQuestionRepository(ds),
            new TypeOrmImportedTransactionRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
        );
    }

    // ─── Transaction question ────────────────────────────────────────────────

    it('asking about a transaction changes its status to "pending_client"', async () => {
        const { client, closePeriod } = await setup();
        const txn = await createTransaction(ds, closePeriod.id, client.id, { vendor: 'Unknown Corp', amount: 5000 });

        const uc = createQuestionUseCase();
        const result = await uc.execute(client.id, txn.id, {
            question: 'Can you confirm what this $5,000 charge to Unknown Corp was for?',
        });

        expect(result.questionId).toBeDefined();

        // Transaction should now be pending_client
        const updated = await new TypeOrmImportedTransactionRepository(ds).findById(txn.id);
        expect(updated!.status).toBe('pending_client');

        // Question record should exist
        const questions = await new TypeOrmClientQuestionRepository(ds).findByClosePeriodId(closePeriod.id);
        expect(questions).toHaveLength(1);
        expect(questions[0].question).toContain('$5,000');
        expect(questions[0].status).toBe('pending');
    });

    // ─── Generic question ────────────────────────────────────────────────────

    it('generic client question (no transaction) creates a question record', async () => {
        const { client } = await setup();

        const uc = createQuestionUseCase();
        const result = await uc.createGenericQuestion(client.id, {
            question: 'Do you have any outstanding invoices from February?',
            category: 'general',
        });

        expect(result.questionId).toBeDefined();
    });
});

describe('Manual Task Status Updates', () => {

    async function setup() {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id);
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Reviewer', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id);
        const closePeriod = await createClosePeriod(ds, client.id, preparer.id, reviewer.id, { totalTasks: 3 });
        return { firm, preparer, client, closePeriod };
    }

    function createTaskUseCase() {
        return new UpdateCloseTaskStatusUseCase(
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
        );
    }

    // ─── Manual complete → task count sync ───────────────────────────────────

    it('manually completing a task updates close period completed count', async () => {
        const { client, closePeriod, preparer } = await setup();

        const task1 = await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Review checklist', status: 'not_started' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Final review', status: 'not_started' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Client follow-up', status: 'not_started' });

        const uc = createTaskUseCase();
        await uc.execute(task1.id, 'complete');

        const cp = await new TypeOrmClosePeriodRepository(ds).findByClientId(client.id);
        expect(cp[0].completedTasks).toBe(1);
        expect(cp[0].totalTasks).toBe(3);
    });

    // ─── Marking incomplete → count goes back down ───────────────────────────

    it('marking a task as incomplete reduces close period completed count', async () => {
        const { client, closePeriod, preparer } = await setup();

        const task1 = await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 1', status: 'complete' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 2', status: 'complete' });

        const uc = createTaskUseCase();
        await uc.execute(task1.id, 'in_progress');

        const cp = await new TypeOrmClosePeriodRepository(ds).findByClientId(client.id);
        expect(cp[0].completedTasks).toBe(1); // Was 2, now 1
    });
});
