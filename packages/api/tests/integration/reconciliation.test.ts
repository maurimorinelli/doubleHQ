/**
 * Reconciliation Workflow — Integration Tests
 *
 * Account reconciliation ensures the books match the bank.
 * When the bank balance matches the book balance, the reconciliation
 * auto-completes the corresponding task (checking or credit card).
 *
 * Business rules tested:
 *   1. Matching bank balance → status "reconciled", task auto-completes
 *   2. Mismatched balance → status stays "in_progress", task NOT completed
 *   3. Reopening a reconciled account → reverts task status, updates task counts
 */
import { DataSource } from 'typeorm';
import { createTestDataSource, clearAll, stopContainer } from '../helpers/test-datasource';
import { createFirm, createTeamMember, createClient, createClosePeriod, createCloseTask, createReconciliation } from '../helpers/factories';
import { ReconcileAccountUseCase } from '../../src/application/use-cases/reconcile-account';
import {
    TypeOrmReconciliationRepository,
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

describe('Reconciliation Workflow', () => {

    async function setup() {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id);
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Reviewer', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id);
        const closePeriod = await createClosePeriod(ds, client.id, preparer.id, reviewer.id, { totalTasks: 2, completedTasks: 0 });
        return { firm, preparer, reviewer, client, closePeriod };
    }

    function createUseCase() {
        return new ReconcileAccountUseCase(
            new TypeOrmReconciliationRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
        );
    }

    // ─── Matching balance → reconciled + auto-complete ───────────────────────

    it('bank balance matching book balance → reconciled, task auto-completes', async () => {
        const { closePeriod, preparer } = await setup();

        const recon = await createReconciliation(ds, closePeriod.id, {
            accountName: 'Business Checking',
            bookBalance: 15000.50,
        });

        const task = await createCloseTask(ds, closePeriod.id, preparer.id, {
            title: 'Reconcile checking account',
            autoCompleteRule: 'checking_reconciled',
        });

        const uc = createUseCase();
        const result = await uc.execute(recon.id, { bankBalance: 15000.50 });

        // Reconciliation is marked reconciled
        expect(result.reconciled).toBe(true);
        expect(result.difference).toBeCloseTo(0, 2);

        // Reconciliation record updated
        const updatedRecon = await new TypeOrmReconciliationRepository(ds).findById(recon.id);
        expect(updatedRecon!.status).toBe('reconciled');

        // Task auto-completed
        const updatedTask = await new TypeOrmCloseTaskRepository(ds).findById(task.id);
        expect(updatedTask!.status).toBe('complete');
    });

    // ─── Mismatched balance → NOT reconciled ─────────────────────────────────

    it('mismatched bank balance → stays in_progress, task NOT completed', async () => {
        const { closePeriod, preparer } = await setup();

        const recon = await createReconciliation(ds, closePeriod.id, {
            accountName: 'Business Checking',
            bookBalance: 15000.50,
        });

        const task = await createCloseTask(ds, closePeriod.id, preparer.id, {
            title: 'Reconcile checking account',
            autoCompleteRule: 'checking_reconciled',
        });

        const uc = createUseCase();
        const result = await uc.execute(recon.id, { bankBalance: 14500.00 });

        // Not reconciled
        expect(result.reconciled).toBe(false);
        expect(result.difference).toBeCloseTo(500.50, 2);

        // Task is NOT completed
        const updatedTask = await new TypeOrmCloseTaskRepository(ds).findById(task.id);
        expect(updatedTask!.status).not.toBe('complete');
    });

    // ─── Reopen reverses task completion ──────────────────────────────────────

    it('reopening a reconciled account → reverts task, updates counts', async () => {
        const { closePeriod, preparer, client } = await setup();

        const recon = await createReconciliation(ds, closePeriod.id, {
            accountName: 'Business Checking',
            bookBalance: 10000,
        });

        const task = await createCloseTask(ds, closePeriod.id, preparer.id, {
            title: 'Reconcile checking account',
            autoCompleteRule: 'checking_reconciled',
        });

        const uc = createUseCase();

        // First reconcile successfully
        await uc.execute(recon.id, { bankBalance: 10000 });
        let updatedTask = await new TypeOrmCloseTaskRepository(ds).findById(task.id);
        expect(updatedTask!.status).toBe('complete');

        // Now reopen
        await uc.reopen(recon.id);

        // Task should be reverted to in_progress
        updatedTask = await new TypeOrmCloseTaskRepository(ds).findById(task.id);
        expect(updatedTask!.status).toBe('in_progress');

        // Close period counts should reflect the revert
        const cp = await new TypeOrmClosePeriodRepository(ds).findByClientId(client.id);
        expect(cp[0].completedTasks).toBe(0);
    });

    // ─── Credit card reconciliation ──────────────────────────────────────────

    it('reconciling credit card account → auto-completes cc_reconciled task', async () => {
        const { closePeriod, preparer } = await setup();

        const recon = await createReconciliation(ds, closePeriod.id, {
            accountName: 'Business Credit Card',
            bookBalance: 5200.75,
        });

        const task = await createCloseTask(ds, closePeriod.id, preparer.id, {
            title: 'Reconcile credit card',
            autoCompleteRule: 'cc_reconciled',
        });

        const uc = createUseCase();
        await uc.execute(recon.id, { bankBalance: 5200.75 });

        const updatedTask = await new TypeOrmCloseTaskRepository(ds).findById(task.id);
        expect(updatedTask!.status).toBe('complete');
    });
});
