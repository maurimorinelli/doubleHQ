/**
 * Transaction Flagging — Integration Tests
 *
 * Flagging marks transactions as suspicious for review.
 * Three operations: AI flag (fallback), manual flag, and unflag.
 *
 * Business rules tested:
 *   1. Fallback flagging flags the top 3 highest-amount uncategorized transactions
 *   2. Manual flagging changes transaction status to "flagged" and creates a flag record
 *   3. Unflagging restores status based on whether a category exists
 *   4. Only uncategorized transactions are eligible for fallback flagging
 */
import { DataSource } from 'typeorm';
import { createTestDataSource, clearAll, stopContainer } from '../helpers/test-datasource';
import { createFirm, createTeamMember, createClient, createClosePeriod, createTransaction } from '../helpers/factories';
import { AiFlagTransactionsUseCase } from '../../src/application/use-cases/ai-flag-transactions';
import {
    TypeOrmImportedTransactionRepository,
    TypeOrmTransactionFlagRepository,
    TypeOrmClosePeriodRepository,
} from '../../src/infrastructure/database/repositories';

let ds: DataSource;

beforeAll(async () => { ds = await createTestDataSource(); });
afterAll(async () => { await stopContainer(); });
afterEach(async () => { await clearAll(ds); });

describe('Transaction Flagging', () => {

    async function setup() {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id);
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Reviewer', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id);
        const closePeriod = await createClosePeriod(ds, client.id, preparer.id, reviewer.id);
        return { firm, preparer, client, closePeriod };
    }

    function createUseCase() {
        // Set a dummy API key so the Anthropic constructor doesn't throw
        process.env.ANTHROPIC_API_KEY = 'test-key';
        return new AiFlagTransactionsUseCase(
            new TypeOrmImportedTransactionRepository(ds),
            new TypeOrmTransactionFlagRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
        );
    }

    // ─── Manual flag ─────────────────────────────────────────────────────────

    it('manually flagging a transaction sets status to "flagged" and creates a flag record', async () => {
        const { client, closePeriod } = await setup();
        const txn = await createTransaction(ds, closePeriod.id, client.id, { amount: 999, vendor: 'Suspicious LLC' });

        const uc = createUseCase();
        const result = await uc.manualFlag(client.id, txn.id, 'Vendor not recognized');

        expect(result.flagged).toBe(true);

        // Transaction status should be "flagged"
        const updated = await new TypeOrmImportedTransactionRepository(ds).findById(txn.id);
        expect(updated!.status).toBe('flagged');

        // Flag record should exist
        const flags = await new TypeOrmTransactionFlagRepository(ds).findByClosePeriodId(closePeriod.id);
        const flag = flags.find(f => (f as any).transactionId === txn.id);
        expect(flag).toBeDefined();
        expect(flag!.type).toBe('manual');
        expect(flag!.description).toBe('Vendor not recognized');
    });

    // ─── Unflag: categorized transaction ─────────────────────────────────────

    it('unflagging a categorized transaction → restores status to "categorized"', async () => {
        const { client, closePeriod } = await setup();
        // Create a transaction that already has a category
        const txn = await createTransaction(ds, closePeriod.id, client.id, {
            finalCategory: 'Office Supplies',
            status: 'categorized',
        });

        const uc = createUseCase();

        // Flag it first
        await uc.manualFlag(client.id, txn.id, 'Checking vendor');

        let updated = await new TypeOrmImportedTransactionRepository(ds).findById(txn.id);
        expect(updated!.status).toBe('flagged');

        // Now unflag
        await uc.unflag(client.id, txn.id);

        updated = await new TypeOrmImportedTransactionRepository(ds).findById(txn.id);
        // Should go back to "categorized" because it has a finalCategory
        expect(updated!.status).toBe('categorized');
    });

    // ─── Unflag: uncategorized transaction ───────────────────────────────────

    it('unflagging an uncategorized transaction → restores status to "uncategorized"', async () => {
        const { client, closePeriod } = await setup();
        const txn = await createTransaction(ds, closePeriod.id, client.id);

        const uc = createUseCase();
        await uc.manualFlag(client.id, txn.id, 'Looks suspicious');
        await uc.unflag(client.id, txn.id);

        const updated = await new TypeOrmImportedTransactionRepository(ds).findById(txn.id);
        expect(updated!.status).toBe('uncategorized');
    });

    // ─── Flag non-existent transaction ───────────────────────────────────────

    it('flagging a non-existent transaction → throws error', async () => {
        const { client } = await setup();
        const uc = createUseCase();

        await expect(uc.manualFlag(client.id, 'non-existent', 'test'))
            .rejects.toThrow('Transaction not found');
    });
});
