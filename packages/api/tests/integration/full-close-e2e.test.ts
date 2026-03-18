/**
 * Full Monthly Close — End-to-End Integration Test
 *
 * This is the single most important test in the suite.
 * It walks through the complete lifecycle of a monthly close,
 * exactly as an accountant would experience it:
 *
 *   1. Start a close from a template
 *   2. Categorize all checking transactions
 *   3. Categorize all credit card transactions
 *   4. Reconcile the checking account
 *   5. Reconcile the credit card
 *   6. Post a depreciation journal entry
 *   7. Manually complete remaining tasks
 *   8. Sign off — close is locked
 *
 * If you read ONE test to understand this product, read this one.
 */
import { DataSource } from 'typeorm';
import { createTestDataSource, clearAll, stopContainer } from '../helpers/test-datasource';
import { createFirm, createTeamMember, createClient, createStandardTemplate } from '../helpers/factories';
import { StartCloseUseCase } from '../../src/application/use-cases/start-close';
import { CategorizeTransactionUseCase } from '../../src/application/use-cases/categorize-transaction';
import { ReconcileAccountUseCase } from '../../src/application/use-cases/reconcile-account';
import { CreateJournalEntryUseCase, PostJournalEntryUseCase } from '../../src/application/use-cases/journal-entry';
import { SignOffCloseUseCase } from '../../src/application/use-cases/sign-off-close';
import {
    TypeOrmClientRepository,
    TypeOrmClosePeriodRepository,
    TypeOrmCloseTaskRepository,
    TypeOrmCloseTemplateRepository,
    TypeOrmImportedTransactionRepository,
    TypeOrmReconciliationRepository,
    TypeOrmJournalEntryRepository,
} from '../../src/infrastructure/database/repositories';
import { AiDataGenerator } from '../../src/domain/services/ai-data-generator.port';

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

function fakeAiGenerator(): AiDataGenerator {
    return {
        async generateClientData() {
            return {
                transactions: [
                    { date: '2026-02-03', description: 'Office rent', vendor: 'WeWork', amount: 3000, type: 'debit' as const, bankAccount: 'checking' as const },
                    { date: '2026-02-10', description: 'Client payment', vendor: 'Acme Inc', amount: 8000, type: 'credit' as const, bankAccount: 'checking' as const },
                    { date: '2026-02-14', description: 'AWS billing', vendor: 'AWS', amount: 450, type: 'debit' as const, bankAccount: 'credit_card' as const },
                    { date: '2026-02-22', description: 'GitHub license', vendor: 'GitHub', amount: 50, type: 'debit' as const, bankAccount: 'credit_card' as const },
                ],
            };
        },
    };
}

describe('Full Monthly Close — End to End', () => {

    it('complete close lifecycle: start → categorize → reconcile → post entry → sign off', async () => {
        // ──────────────────────────────────────────────────────────────
        // SETUP: Firm, team, client, template
        // ──────────────────────────────────────────────────────────────
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id, { name: 'Sarah Chen', role: 'preparer' });
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Mike Torres', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id, { name: 'TechStart Inc' });
        const template = await createStandardTemplate(ds, firm.id);

        const clientRepo = new TypeOrmClientRepository(ds);
        const cpRepo = new TypeOrmClosePeriodRepository(ds);
        const taskRepo = new TypeOrmCloseTaskRepository(ds);
        const templateRepo = new TypeOrmCloseTemplateRepository(ds);
        const txnRepo = new TypeOrmImportedTransactionRepository(ds);
        const reconRepo = new TypeOrmReconciliationRepository(ds);
        const jeRepo = new TypeOrmJournalEntryRepository(ds);

        // ──────────────────────────────────────────────────────────────
        // STEP 1: Start the close
        // ──────────────────────────────────────────────────────────────
        const startClose = new StartCloseUseCase(clientRepo, cpRepo, taskRepo, templateRepo, txnRepo, reconRepo, fakeAiGenerator());
        const closeResult = await startClose.execute(client.id, { templateId: template.id, period: '2026-02' });

        expect(closeResult.status).toBe('in_progress');
        expect(closeResult.totalTasks).toBeGreaterThan(0);
        expect(closeResult.generatedTransactions).toBe(4);

        const closePeriodId = closeResult.closePeriodId;

        // ──────────────────────────────────────────────────────────────
        // STEP 2: Categorize ALL transactions
        // ──────────────────────────────────────────────────────────────
        const categorize = new CategorizeTransactionUseCase(txnRepo, taskRepo, cpRepo);
        const allTxns = await txnRepo.findByClosePeriodId(closePeriodId);

        for (const txn of allTxns) {
            await categorize.execute(txn.id, { finalCategory: 'Office Supplies' });
        }

        // Verify: all categorization tasks should be auto-completed
        const tasksAfterCategorize = await taskRepo.findByClosePeriodId(closePeriodId);
        const categorizationTasks = tasksAfterCategorize.filter(t =>
            t.autoCompleteRule === 'all_transactions_categorized' ||
            t.autoCompleteRule === 'all_cc_categorized' ||
            t.autoCompleteRule === 'no_uncategorized_remaining'
        );
        for (const task of categorizationTasks) {
            expect(task.status).toBe('complete');
        }

        // ──────────────────────────────────────────────────────────────
        // STEP 3: Reconcile both accounts
        // ──────────────────────────────────────────────────────────────
        const reconcile = new ReconcileAccountUseCase(reconRepo, taskRepo, cpRepo);
        const recons = await reconRepo.findByClosePeriodId(closePeriodId);

        for (const recon of recons) {
            // Enter the exact book balance as bank balance → reconciled
            await reconcile.execute(recon.id, { bankBalance: Number(recon.bookBalance) });
        }

        // Verify: reconciliation tasks should be auto-completed
        const tasksAfterRecon = await taskRepo.findByClosePeriodId(closePeriodId);
        const reconTasks = tasksAfterRecon.filter(t =>
            t.autoCompleteRule === 'checking_reconciled' || t.autoCompleteRule === 'cc_reconciled'
        );
        for (const task of reconTasks) {
            expect(task.status).toBe('complete');
        }

        // ──────────────────────────────────────────────────────────────
        // STEP 4: Post a depreciation journal entry
        // ──────────────────────────────────────────────────────────────
        const createEntry = new CreateJournalEntryUseCase(jeRepo, cpRepo);
        const { entryId } = await createEntry.execute(client.id, {
            closePeriodId,
            memo: 'Monthly depreciation — equipment',
            type: 'depreciation',
            date: '2026-02-28',
            lines: [
                { accountName: 'Depreciation Expense', debit: 800, credit: 0 },
                { accountName: 'Accumulated Depreciation', debit: 0, credit: 800 },
            ],
        });

        const postEntry = new PostJournalEntryUseCase(jeRepo, taskRepo, cpRepo);
        const posted = await postEntry.execute(entryId);
        expect(posted.posted).toBe(true);

        // Verify: depreciation task should be auto-completed
        const tasksAfterPost = await taskRepo.findByClosePeriodId(closePeriodId);
        const depTask = tasksAfterPost.find(t => t.autoCompleteRule === 'depreciation_posted');
        expect(depTask?.status).toBe('complete');

        // ──────────────────────────────────────────────────────────────
        // STEP 5: Manually complete remaining tasks
        // ──────────────────────────────────────────────────────────────
        const remainingTasks = tasksAfterPost.filter(t => t.status !== 'complete');
        for (const task of remainingTasks) {
            await taskRepo.updateStatus(task.id, 'complete', new Date());
        }

        // ──────────────────────────────────────────────────────────────
        // STEP 6: Sign off — the final gate
        // ──────────────────────────────────────────────────────────────
        const signOff = new SignOffCloseUseCase(cpRepo, taskRepo);
        const signOffResult = await signOff.execute(client.id, { reviewNotes: 'All clean. Approved by Mike.' });

        expect(signOffResult.locked).toBe(true);
        expect(signOffResult.signedOffAt).toBeDefined();

        // ──────────────────────────────────────────────────────────────
        // FINAL ASSERTIONS: The close period is locked
        // ──────────────────────────────────────────────────────────────
        const finalClosePeriod = (await cpRepo.findByClientId(client.id))[0];
        expect(finalClosePeriod.status).toBe('closed');
        expect(finalClosePeriod.completedDate).not.toBeNull();

        // All tasks are complete
        const allFinalTasks = await taskRepo.findByClosePeriodId(closePeriodId);
        const incomplete = allFinalTasks.filter(t => t.status !== 'complete');
        expect(incomplete).toHaveLength(0);
    });
});
