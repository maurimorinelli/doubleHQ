/**
 * Create Client — Integration Tests
 *
 * Client creation is the onboarding funnel. Every user starts here.
 * Two paths exist:
 *   1. Client only — no close period (just the client record)
 *   2. Client + close period — immediately starts a monthly close
 *
 * Business rules tested:
 *   1. Creating a client without a close period returns client-only result
 *   2. Creating a client WITH a close period creates tasks and transactions
 *   3. Preparer and reviewer are auto-assigned from the firm's team
 *   4. Client fields are persisted correctly
 */
import { DataSource } from 'typeorm';
import { createTestDataSource, clearAll, stopContainer } from '../helpers/test-datasource';
import { createFirm, createTeamMember, createStandardTemplate } from '../helpers/factories';
import { CreateClientUseCase } from '../../src/application/use-cases/create-client';
import {
    TypeOrmClientRepository,
    TypeOrmClosePeriodRepository,
    TypeOrmCloseTaskRepository,
    TypeOrmCloseTemplateRepository,
    TypeOrmImportedTransactionRepository,
    TypeOrmReconciliationRepository,
    TypeOrmTeamMemberRepository,
} from '../../src/infrastructure/database/repositories';
import { AiDataGenerator } from '../../src/domain/services/ai-data-generator.port';

let ds: DataSource;

beforeAll(async () => { ds = await createTestDataSource(); });
afterAll(async () => { await stopContainer(); });
afterEach(async () => { await clearAll(ds); });

function fakeAiGenerator(): AiDataGenerator {
    return {
        async generateClientData() {
            return {
                transactions: [
                    { date: '2026-02-10', description: 'Test txn', vendor: 'Vendor', amount: 100, type: 'debit' as const, bankAccount: 'checking' as const },
                ],
            };
        },
    };
}

describe('Create Client', () => {

    async function setup() {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id, { name: 'Sarah', role: 'preparer' });
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Mike', role: 'reviewer' });
        return { firm, preparer, reviewer };
    }

    function createUseCase() {
        return new CreateClientUseCase(
            new TypeOrmClientRepository(ds),
            new TypeOrmClosePeriodRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
            new TypeOrmCloseTemplateRepository(ds),
            new TypeOrmImportedTransactionRepository(ds),
            new TypeOrmReconciliationRepository(ds),
            new TypeOrmTeamMemberRepository(ds),
            fakeAiGenerator(),
        );
    }

    // ─── Client without close period ─────────────────────────────────────────

    it('creating a client WITHOUT a close period → client-only result, no tasks', async () => {
        const { firm } = await setup();
        const uc = createUseCase();

        const result = await uc.execute(firm.id, {
            name: 'Simple Corp',
            industry: 'Consulting',
            contactName: 'Jane Doe',
            contactEmail: 'jane@simple.com',
            contactPhone: '555-0001',
            qboConnected: false,
            monthlyRevenue: 20000,
            accountType: 'accrual',
            fiscalYearEnd: 12,
            notes: '',
        } as any);

        expect(result.clientId).toBeDefined();
        expect(result.closePeriodId).toBeNull();
        expect(result.totalTasks).toBe(0);
        expect(result.generatedTransactions).toBe(0);

        // Client should exist in DB
        const client = await new TypeOrmClientRepository(ds).findById(result.clientId);
        expect(client).not.toBeNull();
        expect(client!.name).toBe('Simple Corp');
        expect(client!.industry).toBe('Consulting');
    });

    // ─── Client WITH close period ────────────────────────────────────────────

    it('creating a client WITH a close period → creates tasks, transactions, and reconciliations', async () => {
        const { firm } = await setup();
        const template = await createStandardTemplate(ds, firm.id);
        const uc = createUseCase();

        const result = await uc.execute(firm.id, {
            name: 'Growth Inc',
            industry: 'Technology',
            contactName: 'John Smith',
            contactEmail: 'john@growth.com',
            contactPhone: '555-0002',
            qboConnected: true,
            monthlyRevenue: 50000,
            accountType: 'accrual',
            fiscalYearEnd: 12,
            notes: 'VIP client',
            templateId: template.id,
            closePeriod: '2026-02',
        } as any);

        expect(result.clientId).toBeDefined();
        expect(result.closePeriodId).not.toBeNull();
        expect(result.totalTasks).toBeGreaterThan(0);
        expect(result.generatedTransactions).toBe(1); // from our fake AI

        // Verify close period exists
        const cp = await new TypeOrmClosePeriodRepository(ds).findByClientId(result.clientId);
        expect(cp).toHaveLength(1);
        expect(cp[0].status).toBe('in_progress');
    });

    // ─── Team assignment ─────────────────────────────────────────────────────

    it('preparer and reviewer are auto-assigned from the firm team', async () => {
        const { firm, preparer, reviewer } = await setup();
        const uc = createUseCase();

        const result = await uc.execute(firm.id, {
            name: 'Team Test Corp',
            industry: 'Finance',
            contactName: 'Bob',
            contactEmail: 'bob@test.com',
            contactPhone: '',
            qboConnected: false,
            monthlyRevenue: 10000,
            accountType: 'cash',
            fiscalYearEnd: 12,
            notes: '',
        } as any);

        const client = await new TypeOrmClientRepository(ds).findById(result.clientId);
        expect(client).not.toBeNull();
        // Should be assigned one of our team members
        expect([preparer.id, reviewer.id]).toContain(client!.preparerId);
        expect([preparer.id, reviewer.id]).toContain(client!.reviewerId);
    });
});
