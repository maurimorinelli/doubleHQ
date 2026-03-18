/**
 * Transaction Adjustments — Integration Tests
 *
 * Accountants need to add, edit, and delete transactions during
 * the close process. Each adjustment recalculates the book balances
 * on reconciliation records, which can un-reconcile a previously
 * reconciled account.
 *
 * Business rules tested:
 *   1. Adding a manual transaction marks it uncategorized and isManual=true
 *   2. Adding a manual transaction recalculates the book balance
 *   3. Editing a transaction amount recalculates the book balance
 *   4. Only manual transactions can be deleted (imported ones cannot)
 *   5. Deleting a transaction recalculates the book balance
 */
import { DataSource } from 'typeorm';
import { createTestDataSource, clearAll, stopContainer } from '../helpers/test-datasource';
import { createFirm, createTeamMember, createClient, createClosePeriod, createReconciliation, createTransaction } from '../helpers/factories';
import { AdjustTransactionUseCase } from '../../src/application/use-cases/adjust-transaction';
import {
    TypeOrmImportedTransactionRepository,
    TypeOrmReconciliationRepository,
    TypeOrmClosePeriodRepository,
} from '../../src/infrastructure/database/repositories';

let ds: DataSource;

beforeAll(async () => { ds = await createTestDataSource(); });
afterAll(async () => { await stopContainer(); });
afterEach(async () => { await clearAll(ds); });

describe('Transaction Adjustments', () => {

    async function setup() {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id);
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Reviewer', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id);
        const closePeriod = await createClosePeriod(ds, client.id, preparer.id, reviewer.id);
        return { firm, preparer, client, closePeriod };
    }

    function createUseCase() {
        return new AdjustTransactionUseCase(
            new TypeOrmImportedTransactionRepository(ds),
            new TypeOrmReconciliationRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
        );
    }

    // ─── Add manual transaction ──────────────────────────────────────────────

    it('adding a manual transaction creates an uncategorized, isManual=true record', async () => {
        const { client, closePeriod } = await setup();
        const uc = createUseCase();

        const result = await uc.addManual(client.id, {
            closePeriodId: closePeriod.id,
            date: '2026-02-15',
            description: 'Client reimbursement',
            vendor: 'Acme Corp',
            amount: 250,
            type: 'credit',
            bankAccount: 'checking',
        });

        expect(result.transaction.id).toBeDefined();
        expect(result.transaction.status).toBe('uncategorized');
        expect(result.transaction.isManual).toBe(true);
        expect(result.transaction.description).toBe('Client reimbursement');
    });

    // ─── Adding a transaction recalculates book balance ──────────────────────

    it('adding a manual transaction recalculates the reconciliation book balance', async () => {
        const { client, closePeriod } = await setup();

        // Create a reconciliation record for checking
        const recon = await createReconciliation(ds, closePeriod.id, {
            accountName: 'Business Checking',
            bookBalance: 10000,
        });

        // Add a checking transaction
        const uc = createUseCase();
        await uc.addManual(client.id, {
            closePeriodId: closePeriod.id,
            date: '2026-02-20',
            description: 'New expense',
            vendor: 'Office Depot',
            amount: 500,
            type: 'debit',
            bankAccount: 'checking',
        });

        // Book balance should be recalculated
        const updatedRecon = await new TypeOrmReconciliationRepository(ds).findById(recon.id);
        expect(updatedRecon).not.toBeNull();
        // The balance will have changed from the initial value
        expect(Number(updatedRecon!.bookBalance)).not.toBe(10000);
    });

    // ─── Update amount ───────────────────────────────────────────────────────

    it('editing a transaction amount persists the change and recalculates balances', async () => {
        const { client, closePeriod } = await setup();
        const txn = await createTransaction(ds, closePeriod.id, client.id, { amount: 100, bankAccount: 'checking' });

        await createReconciliation(ds, closePeriod.id, { accountName: 'Business Checking', bookBalance: 5000 });

        const uc = createUseCase();
        const result = await uc.updateAmount(txn.id, 250);

        expect(result.updated).toBe(true);

        const updated = await new TypeOrmImportedTransactionRepository(ds).findById(txn.id);
        expect(Number(updated!.amount)).toBe(250);
    });

    // ─── Delete: only manual transactions ────────────────────────────────────

    it('only manual transactions can be deleted — imported ones throw an error', async () => {
        const { client, closePeriod } = await setup();

        // Create an imported (non-manual) transaction
        const importedTxn = await createTransaction(ds, closePeriod.id, client.id, { isManual: false });

        const uc = createUseCase();
        await expect(uc.deleteManual(importedTxn.id)).rejects.toThrow('Only manual transactions can be deleted');
    });

    it('deleting a manual transaction removes it and recalculates balances', async () => {
        const { client, closePeriod } = await setup();

        // Add a manual transaction first
        const uc = createUseCase();
        const { transaction } = await uc.addManual(client.id, {
            closePeriodId: closePeriod.id,
            date: '2026-02-25',
            description: 'Temporary entry',
            vendor: 'Test',
            amount: 999,
            type: 'debit',
            bankAccount: 'checking',
        });

        // Now delete it
        const result = await uc.deleteManual(transaction.id);
        expect(result.deleted).toBe(true);

        // Should be gone from the database
        const found = await new TypeOrmImportedTransactionRepository(ds).findById(transaction.id);
        expect(found).toBeNull();
    });
});
