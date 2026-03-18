/**
 * Sign-Off — Integration Tests
 *
 * Sign-off is the final gate of the monthly close. The reviewer (manager)
 * can only sign off when every task is complete. Once signed off, the
 * close period is locked with status "closed".
 *
 * Business rules tested:
 *   1. Cannot sign off when tasks are incomplete → error with count
 *   2. All tasks complete → sign-off succeeds, close period becomes "closed"
 *   3. No active close period → throws error
 */
import { DataSource } from 'typeorm';
import { createTestDataSource, clearAll, stopContainer } from '../helpers/test-datasource';
import { createFirm, createTeamMember, createClient, createClosePeriod, createCloseTask } from '../helpers/factories';
import { SignOffCloseUseCase } from '../../src/application/use-cases/sign-off-close';
import {
    TypeOrmClosePeriodRepository,
    TypeOrmCloseTaskRepository,
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

describe('Sign-Off', () => {

    async function setup() {
        const firm = await createFirm(ds);
        const preparer = await createTeamMember(ds, firm.id);
        const reviewer = await createTeamMember(ds, firm.id, { name: 'Reviewer', role: 'reviewer' });
        const client = await createClient(ds, firm.id, preparer.id, reviewer.id);
        return { firm, preparer, reviewer, client };
    }

    function createUseCase() {
        return new SignOffCloseUseCase(
            new TypeOrmClosePeriodRepository(ds),
            new TypeOrmCloseTaskRepository(ds),
        );
    }

    // ─── Cannot sign off with incomplete tasks ───────────────────────────────

    it('cannot sign off when tasks are incomplete → error with remaining count', async () => {
        const { client, preparer, reviewer } = await setup();
        const closePeriod = await createClosePeriod(ds, client.id, preparer.id, reviewer.id, { totalTasks: 3 });

        // 2 complete, 1 not started
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 1', status: 'complete' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 2', status: 'complete' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 3', status: 'not_started' });

        const uc = createUseCase();
        await expect(uc.execute(client.id, { reviewNotes: 'All good' }))
            .rejects.toThrow('1 task(s) still incomplete');
    });

    // ─── All tasks complete → sign-off succeeds ──────────────────────────────

    it('all tasks complete → sign-off succeeds, close period status becomes "closed"', async () => {
        const { client, preparer, reviewer } = await setup();
        const closePeriod = await createClosePeriod(ds, client.id, preparer.id, reviewer.id, { totalTasks: 3 });

        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 1', status: 'complete' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 2', status: 'complete' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 3', status: 'complete' });

        const uc = createUseCase();
        const result = await uc.execute(client.id, { reviewNotes: 'Approved — clean close' });

        expect(result.locked).toBe(true);
        expect(result.signedOffAt).toBeDefined();

        // Verify the close period is now "closed" in the database
        const cp = await new TypeOrmClosePeriodRepository(ds).findByClientId(client.id);
        expect(cp[0].status).toBe('closed');
    });

    // ─── No active close period → error ──────────────────────────────────────

    it('no active close period → throws error', async () => {
        const { client } = await setup();

        const uc = createUseCase();
        await expect(uc.execute(client.id, { reviewNotes: 'N/A' }))
            .rejects.toThrow('No active close period');
    });

    // ─── Multiple incomplete tasks → error message includes count ────────────

    it('multiple incomplete tasks → error shows correct count', async () => {
        const { client, preparer, reviewer } = await setup();
        const closePeriod = await createClosePeriod(ds, client.id, preparer.id, reviewer.id);

        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 1', status: 'complete' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 2', status: 'in_progress' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 3', status: 'not_started' });
        await createCloseTask(ds, closePeriod.id, preparer.id, { title: 'Task 4', status: 'blocked' });

        const uc = createUseCase();
        await expect(uc.execute(client.id, { reviewNotes: 'N/A' }))
            .rejects.toThrow('3 task(s) still incomplete');
    });
});
