/**
 * Journal Entry Balance Validation — Unit Tests
 *
 * Core accounting rule: debits must equal credits before posting.
 * These tests verify the PostJournalEntryUseCase enforces this invariant
 * using mock repositories — no database needed.
 */
import { PostJournalEntryUseCase } from '../../src/application/use-cases/journal-entry';
import { JournalEntryRepository, CloseTaskRepository, ClosePeriodRepository } from '../../src/domain/ports';

function mockJournalEntryRepo(entry: any): JournalEntryRepository {
    return {
        findByClosePeriodId: jest.fn(),
        findById: jest.fn().mockResolvedValue(entry),
        save: jest.fn(),
        updateStatus: jest.fn(),
    };
}

function mockTaskRepo(): CloseTaskRepository {
    return {
        findByClosePeriodId: jest.fn().mockResolvedValue([]),
        findById: jest.fn(),
        updateStatus: jest.fn(),
        saveBatch: jest.fn(),
    };
}

function mockClosePeriodRepo(): ClosePeriodRepository {
    return {
        findActiveByFirmId: jest.fn(),
        findByClientId: jest.fn(),
        findLatestByClientId: jest.fn(),
        updateHealthScore: jest.fn(),
        save: jest.fn(),
        updateTaskCounts: jest.fn(),
        updateSignoff: jest.fn(),
    };
}

describe('PostJournalEntryUseCase — Balance Validation', () => {

    // ─── Balanced entry posts successfully ───────────────────────────────────

    it('balanced entry (debits = credits) → posts successfully', async () => {
        const entry = {
            id: 'je-1',
            closePeriodId: 'cp-1',
            type: 'adjustment',
            status: 'draft',
            lines: [
                { id: 'l1', accountName: 'Cash', debit: 1000, credit: null },
                { id: 'l2', accountName: 'Revenue', debit: null, credit: 1000 },
            ],
        };

        const jeRepo = mockJournalEntryRepo(entry);
        const uc = new PostJournalEntryUseCase(jeRepo, mockTaskRepo(), mockClosePeriodRepo());

        const result = await uc.execute('je-1');

        expect(result.posted).toBe(true);
        expect(jeRepo.updateStatus).toHaveBeenCalledWith('je-1', 'posted', expect.any(Date));
    });

    // ─── Unbalanced entry throws clear error ─────────────────────────────────

    it('unbalanced entry (debits ≠ credits) → throws error with amounts', async () => {
        const entry = {
            id: 'je-2',
            closePeriodId: 'cp-1',
            type: 'adjustment',
            status: 'draft',
            lines: [
                { id: 'l1', accountName: 'Rent Expense', debit: 3000, credit: null },
                { id: 'l2', accountName: 'Cash', debit: null, credit: 2500 },
            ],
        };

        const jeRepo = mockJournalEntryRepo(entry);
        const uc = new PostJournalEntryUseCase(jeRepo, mockTaskRepo(), mockClosePeriodRepo());

        await expect(uc.execute('je-2')).rejects.toThrow('Entry not balanced');
        expect(jeRepo.updateStatus).not.toHaveBeenCalled();
    });

    // ─── Already-posted entry is rejected ────────────────────────────────────

    it('already-posted entry → throws "Entry already posted"', async () => {
        const entry = {
            id: 'je-3',
            closePeriodId: 'cp-1',
            type: 'adjustment',
            status: 'posted',
            lines: [
                { id: 'l1', accountName: 'Cash', debit: 500, credit: null },
                { id: 'l2', accountName: 'Revenue', debit: null, credit: 500 },
            ],
        };

        const jeRepo = mockJournalEntryRepo(entry);
        const uc = new PostJournalEntryUseCase(jeRepo, mockTaskRepo(), mockClosePeriodRepo());

        await expect(uc.execute('je-3')).rejects.toThrow('Entry already posted');
    });

    // ─── Entry not found ─────────────────────────────────────────────────────

    it('non-existent entry → throws "Journal entry not found"', async () => {
        const jeRepo = mockJournalEntryRepo(null);
        const uc = new PostJournalEntryUseCase(jeRepo, mockTaskRepo(), mockClosePeriodRepo());

        await expect(uc.execute('nonexistent')).rejects.toThrow('Journal entry not found');
    });
});
