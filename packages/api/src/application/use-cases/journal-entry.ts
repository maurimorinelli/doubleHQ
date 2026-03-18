import { JournalEntryRepository, CloseTaskRepository, ClosePeriodRepository } from '../../domain/ports/index';
import { v4 as uuid } from 'uuid';
import { JournalEntryType, JournalEntryStatus } from '@doublehq/shared';

export class CreateJournalEntryUseCase {
    constructor(
        private jeRepo: JournalEntryRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) { }

    async execute(clientId: string, data: {
        closePeriodId: string;
        memo: string;
        type: string;
        date: string;
        lines: Array<{ accountName: string; debit: number; credit: number; description?: string }>;
    }): Promise<{ entryId: string }> {
        // Look up the close period to get the preparer (current user)
        const closePeriod = await this.closePeriodRepo.findLatestByClientId(clientId);
        const createdBy = closePeriod?.preparerId || 'tm_001';

        const entry = await this.jeRepo.save({
            id: uuid(),
            closePeriodId: data.closePeriodId,
            date: new Date(data.date),
            memo: data.memo,
            type: data.type as JournalEntryType,
            status: JournalEntryStatus.DRAFT,
            createdBy,
            postedAt: null,
            lines: data.lines.map(l => ({
                id: uuid(),
                journalEntryId: '', // will be set by ORM
                accountName: l.accountName,
                debit: l.debit || null,
                credit: l.credit || null,
                description: l.description || null,
            })),
        });

        return { entryId: entry.id };
    }
}

export class PostJournalEntryUseCase {
    constructor(
        private jeRepo: JournalEntryRepository,
        private taskRepo: CloseTaskRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) { }

    async execute(entryId: string): Promise<{ posted: boolean }> {
        const entry = await this.jeRepo.findById(entryId);
        if (!entry) throw new Error('Journal entry not found');
        if (entry.status === 'posted') throw new Error('Entry already posted');

        // Validate debits = credits
        const lines = entry.lines || [];
        const totalDebits = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
        const totalCredits = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
        if (Math.abs(totalDebits - totalCredits) >= 0.01) {
            throw new Error(`Entry not balanced: debits=$${totalDebits.toFixed(2)} credits=$${totalCredits.toFixed(2)}`);
        }

        await this.jeRepo.updateStatus(entryId, 'posted', new Date());

        // Check auto-complete for depreciation task
        if (entry.type === 'depreciation') {
            const tasks = await this.taskRepo.findByClosePeriodId(entry.closePeriodId);
            const task = tasks.find(t => t.autoCompleteRule === 'depreciation_posted' && t.status !== 'complete');
            if (task) {
                await this.taskRepo.updateStatus(task.id, 'complete', new Date());
                const completed = tasks.filter(t => t.status === 'complete').length + 1;
                await this.closePeriodRepo.updateTaskCounts(entry.closePeriodId, completed, tasks.length);
            }
        }

        return { posted: true };
    }
}
