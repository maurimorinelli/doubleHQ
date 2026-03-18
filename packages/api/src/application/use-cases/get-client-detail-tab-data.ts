import type {
    ClientTransactionsResponse,
    ClientReconciliationsResponse,
    ClientJournalEntriesResponse,
    TransactionItem,
    TransactionSummary,
    ReconciliationCard,
    JournalEntryItem,
    ReconciliationSummaryByAccount,
} from '@doublehq/shared';
import {
    ClientRepository,
    ClosePeriodRepository,
    ImportedTransactionRepository,
    ReconciliationRepository,
    JournalEntryRepository,
    CloseTaskRepository,
} from '../../domain/ports';
import { ClientNotFoundError } from '../../domain/errors';

// ─── GetClientTransactionsUseCase ────────────────────────────────────────────

export class GetClientTransactionsUseCase {
    constructor(
        private clientRepo: ClientRepository,
        private closePeriodRepo: ClosePeriodRepository,
        private txnRepo: ImportedTransactionRepository,
        private reconRepo?: ReconciliationRepository,
    ) { }

    async execute(clientId: string): Promise<ClientTransactionsResponse> {
        const client = await this.clientRepo.findById(clientId);
        if (!client) throw new ClientNotFoundError(clientId);

        const cp = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!cp) {
            return { summary: { total: 0, categorized: 0, uncategorized: 0, flagged: 0, pendingClient: 0 }, transactions: [], reconciliationSummary: [] };
        }

        const txns = await this.txnRepo.findByClosePeriodId(cp.id);

        const summary: TransactionSummary = {
            total: txns.length,
            categorized: txns.filter(t => t.status === 'categorized').length,
            uncategorized: txns.filter(t => t.status === 'uncategorized').length,
            flagged: txns.filter(t => t.status === 'flagged').length,
            pendingClient: txns.filter(t => t.status === 'pending_client').length,
        };

        const transactions: TransactionItem[] = txns.map(t => ({
            id: t.id,
            date: new Date(t.date).toISOString().split('T')[0],
            description: t.description,
            vendor: t.vendor,
            amount: Number(t.amount),
            type: t.type,
            bankAccount: t.bankAccount,
            importedCategory: t.importedCategory,
            finalCategory: t.finalCategory,
            status: t.status,
            aiSuggestedCategory: t.aiSuggestedCategory,
            aiConfidence: t.aiConfidence ? Number(t.aiConfidence) : null,
            isManual: !!t.isManual,
        }));

        // Build reconciliation summary per account
        let reconciliationSummary: ReconciliationSummaryByAccount[] = [];
        if (this.reconRepo) {
            const recons = await this.reconRepo.findByClosePeriodId(cp.id);
            const accountMapping: Record<string, string> = {
                'Business Checking': 'checking',
                'Business Credit Card': 'credit_card',
            };
            reconciliationSummary = recons.map(r => ({
                bankAccount: accountMapping[r.accountName] || r.accountName,
                accountLabel: r.accountName,
                bookBalance: Number(r.bookBalance),
                bankBalance: r.bankBalance != null ? Number(r.bankBalance) : null,
                difference: Number(r.difference),
                status: r.status,
            }));
        }

        return { summary, transactions, reconciliationSummary };
    }
}

// ─── GetClientReconciliationsUseCase ─────────────────────────────────────────

export class GetClientReconciliationsUseCase {
    constructor(
        private clientRepo: ClientRepository,
        private closePeriodRepo: ClosePeriodRepository,
        private reconRepo: ReconciliationRepository,
    ) { }

    async execute(clientId: string): Promise<ClientReconciliationsResponse> {
        const client = await this.clientRepo.findById(clientId);
        if (!client) throw new ClientNotFoundError(clientId);

        const cp = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!cp) return { reconciliations: [] };

        const recons = await this.reconRepo.findByClosePeriodId(cp.id);

        const reconciliations: ReconciliationCard[] = recons.map(r => ({
            id: r.id,
            accountName: r.accountName,
            accountNumber: r.accountNumber,
            bookBalance: Number(r.bookBalance),
            bankBalance: r.bankBalance != null ? Number(r.bankBalance) : null,
            difference: Number(r.difference),
            status: r.status,
            reconciledBy: r.reconciledBy,
            reconciledAt: r.reconciledAt ? new Date(r.reconciledAt).toISOString() : null,
            notes: r.notes,
        }));

        return { reconciliations };
    }
}

// ─── GetClientJournalEntriesUseCase ──────────────────────────────────────────

export class GetClientJournalEntriesUseCase {
    constructor(
        private clientRepo: ClientRepository,
        private closePeriodRepo: ClosePeriodRepository,
        private jeRepo: JournalEntryRepository,
    ) { }

    async execute(clientId: string): Promise<ClientJournalEntriesResponse> {
        const client = await this.clientRepo.findById(clientId);
        if (!client) throw new ClientNotFoundError(clientId);

        const cp = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!cp) return { entries: [] };

        const entries = await this.jeRepo.findByClosePeriodId(cp.id);

        const items: JournalEntryItem[] = entries.map(e => ({
            id: e.id,
            date: new Date(e.date).toISOString().split('T')[0],
            memo: e.memo,
            type: e.type,
            status: e.status,
            createdBy: e.creator?.name || e.createdBy,
            postedAt: e.postedAt ? new Date(e.postedAt).toISOString() : null,
            lines: (e.lines || []).map(l => ({
                id: l.id,
                accountName: l.accountName,
                debit: l.debit != null ? Number(l.debit) : null,
                credit: l.credit != null ? Number(l.credit) : null,
                description: l.description,
            })),
        }));

        return { entries: items };
    }
}

// ─── UpdateCloseTaskStatusUseCase ────────────────────────────────────────────

export class UpdateCloseTaskStatusUseCase {
    constructor(
        private taskRepo: CloseTaskRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) { }

    async execute(taskId: string, status: string): Promise<{ id: string; status: string }> {
        const completedDate = status === 'complete' ? new Date() : null;
        await this.taskRepo.updateStatus(taskId, status, completedDate);

        // Sync close period task counts so progress bar stays accurate
        const task = await this.taskRepo.findById(taskId);
        if (task) {
            const allTasks = await this.taskRepo.findByClosePeriodId(task.closePeriodId);
            const completed = allTasks.filter(t => t.status === 'complete').length;
            await this.closePeriodRepo.updateTaskCounts(task.closePeriodId, completed, allTasks.length);
        }

        return { id: taskId, status };
    }
}
