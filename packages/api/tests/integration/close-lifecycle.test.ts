/**
 * Close Lifecycle — Integration Tests
 *
 * Tests the StartCloseUseCase: Creates a close period from a template,
 * generating tasks, transactions, and reconciliation records.
 *
 * This is the entry point for every monthly close. When an accountant
 * starts a close, the system should:
 *   1. Create a close period with proper dates and status
 *   2. Copy every task from the template to the close period
 *   3. Generate transactions (via AI — mocked in tests)
 *   4. Create reconciliation records for checking & credit card
 *   5. Reject duplicate close periods for the same client/month
 */
import { DataSource } from 'typeorm';
import { createTestDataSource, clearAll, stopContainer } from '../helpers/test-datasource';
import { createFirm, createTeamMember, createClient, createStandardTemplate } from '../helpers/factories';
import { StartCloseUseCase } from '../../src/application/use-cases/start-close';
import {
    TypeOrmClientRepository,
    TypeOrmClosePeriodRepository,
    TypeOrmCloseTaskRepository,
    TypeOrmCloseTemplateRepository,
    TypeOrmImportedTransactionRepository,
    TypeOrmReconciliationRepository,
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

/** Fake AI generator that returns predictable transactions for testing */
function fakeAiGenerator(): AiDataGenerator {
    return {
        async generateClientData() {
            return {
                transactions: [
                    { date: '2026-02-05', description: 'Office rent', vendor: 'WeWork', amount: 3000, type: 'debit', bankAccount: 'checking' },
                    { date: '2026-02-10', description: 'AWS billing', vendor: 'AWS', amount: 500, type: 'debit', bankAccount: 'credit_card' },
                    { date: '2026-02-15', description: 'Client payment', vendor: 'Acme Inc', amount: 10000, type: 'credit', bankAccount: 'checking' },
                    { date: '2026-02-20', description: 'Software license', vendor: 'GitHub', amount: 50, type: 'debit', bankAccount: 'credit_card' },
                ],
            };
        },
    };
}

describe('Close Lifecycle', () => {

    it('starting a close creates tasks from the template, transactions, and reconciliation records', async () => {
        // Arrange: firm, team, client, template
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id, { name: 'Sarah (Preparer)', role: 'preparer' });
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Mike (Reviewer)', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id, { name: 'TechStart Inc' });
        const template = await createStandardTemplate(ds, firm.id);

        const uc = new StartCloseUseCase(
            new TypeOrmClientRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmCloseTemplateRepository(ds),
            new TypeOrmImportedTransactionRepository(ds),
            new TypeOrmReconciliationRepository(ds),
            fakeAiGenerator(),
        );

        // Act
        const result = await uc.execute(client.id, { templateId: template.id, period: '2026-02' });

        // Assert: close period was created
        expect(result.status).toBe('in_progress');
        expect(result.period).toBe('2026-02');

        // Assert: tasks were created from template (10 tasks in standard template)
        const taskRepo = new TypeOrmCloseTaskRepository(ds);
        const tasks = await taskRepo.findByClosePeriodId(result.closePeriodId);
        expect(tasks.length).toBe(result.totalTasks);
        expect(tasks.length).toBeGreaterThan(0);

        // Assert: transactions were generated (4 from our fake AI)
        const txnRepo = new TypeOrmImportedTransactionRepository(ds);
        const txns = await txnRepo.findByClosePeriodId(result.closePeriodId);
        expect(txns.length).toBe(4);
        expect(txns.every(t => t.status === 'uncategorized')).toBe(true);

        // Assert: reconciliation records exist for checking and credit card
        const reconRepo = new TypeOrmReconciliationRepository(ds);
        const recons = await reconRepo.findByClosePeriodId(result.closePeriodId);
        expect(recons.length).toBe(2);
        expect(recons.map(r => r.accountName).sort()).toEqual(['Business Checking', 'Business Credit Card']);
        expect(recons.every(r => r.status === 'not_started')).toBe(true);
    });

    it('duplicate close period for the same client/period is rejected', async () => {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id);
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Reviewer', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id);
        const template = await createStandardTemplate(ds, firm.id);

        const uc = new StartCloseUseCase(
            new TypeOrmClientRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmCloseTemplateRepository(ds),
            new TypeOrmImportedTransactionRepository(ds),
            new TypeOrmReconciliationRepository(ds),
            fakeAiGenerator(),
        );

        // First close succeeds
        await uc.execute(client.id, { templateId: template.id, period: '2026-02' });

        // Second close for same period is rejected
        await expect(uc.execute(client.id, { templateId: template.id, period: '2026-02' }))
            .rejects.toThrow('already exists');
    });

    it('non-existent client throws an error', async () => {
        const firm = await createFirm(ds);
        const template = await createStandardTemplate(ds, firm.id);

        const uc = new StartCloseUseCase(
            new TypeOrmClientRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmCloseTemplateRepository(ds),
            new TypeOrmImportedTransactionRepository(ds),
            new TypeOrmReconciliationRepository(ds),
            fakeAiGenerator(),
        );

        await expect(uc.execute('nonexistent-client-id', { templateId: template.id, period: '2026-02' }))
            .rejects.toThrow('not found');
    });

    it('non-existent template throws an error', async () => {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id);
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Reviewer', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id);

        const uc = new StartCloseUseCase(
            new TypeOrmClientRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmCloseTemplateRepository(ds),
            new TypeOrmImportedTransactionRepository(ds),
            new TypeOrmReconciliationRepository(ds),
            fakeAiGenerator(),
        );

        await expect(uc.execute(client.id, { templateId: 'nonexistent-template-id', period: '2026-02' }))
            .rejects.toThrow('not found');
    });
});
