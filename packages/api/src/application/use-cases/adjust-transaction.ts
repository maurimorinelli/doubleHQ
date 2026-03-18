import { v4 as uuid } from 'uuid';
import { ImportedTransactionRepository, ReconciliationRepository, ClosePeriodRepository } from '../../domain/ports/index';
import { ImportedTransaction } from '../../domain/entities/index';
import { TransactionStatus, TransactionType, BankAccountType, ReconciliationStatus } from '@doublehq/shared';

export class AdjustTransactionUseCase {
    constructor(
        private txnRepo: ImportedTransactionRepository,
        private reconRepo: ReconciliationRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) { }

    /** Update the amount on an existing transaction */
    async updateAmount(txnId: string, amount: number): Promise<{ updated: boolean }> {
        const txn = await this.txnRepo.findById(txnId);
        if (!txn) throw new Error('Transaction not found');

        await this.txnRepo.updateAmount(txnId, amount);
        await this.recalcBookBalances(txn.closePeriodId);
        return { updated: true };
    }

    /** Create a new manual transaction */
    async addManual(clientId: string, data: {
        closePeriodId: string;
        date: string;
        description: string;
        vendor: string;
        amount: number;
        type: 'debit' | 'credit';
        bankAccount: 'checking' | 'credit_card';
    }): Promise<{ transaction: ImportedTransaction }> {
        const txn: ImportedTransaction = {
            id: uuid(),
            closePeriodId: data.closePeriodId,
            clientId,
            date: new Date(data.date),
            description: data.description,
            vendor: data.vendor,
            amount: data.amount,
            type: data.type as TransactionType,
            bankAccount: data.bankAccount as BankAccountType,
            importedCategory: null,
            finalCategory: null,
            status: TransactionStatus.UNCATEGORIZED,
            aiSuggestedCategory: null,
            aiConfidence: null,
            reviewedBy: null,
            reviewedAt: null,
            isManual: true,
        };

        const saved = await this.txnRepo.saveOne(txn);
        await this.recalcBookBalances(data.closePeriodId);
        return { transaction: saved };
    }

    /** Delete a manually-added transaction */
    async deleteManual(txnId: string): Promise<{ deleted: boolean }> {
        const txn = await this.txnRepo.findById(txnId);
        if (!txn) throw new Error('Transaction not found');
        if (!txn.isManual) throw new Error('Only manual transactions can be deleted');

        const closePeriodId = txn.closePeriodId;
        await this.txnRepo.deleteById(txnId);
        await this.recalcBookBalances(closePeriodId);
        return { deleted: true };
    }

    /** Recalculate the bookBalance on all reconciliation records for a close period */
    private async recalcBookBalances(closePeriodId: string): Promise<void> {
        const sums = await this.txnRepo.sumByClosePeriodAndAccount(closePeriodId);
        const recons = await this.reconRepo.findByClosePeriodId(closePeriodId);

        // Map bankAccount values to reconciliation account names
        const accountMapping: Record<string, string> = {
            checking: 'Business Checking',
            credit_card: 'Business Credit Card',
        };

        for (const recon of recons) {
            // Find matching sum by account name
            const matchingKey = Object.entries(accountMapping)
                .find(([, name]) => name === recon.accountName)?.[0];

            const sumEntry = sums.find(s => s.bankAccount === matchingKey);
            // Book balance = net of transactions (credits - debits) for the account
            const bookBalance = sumEntry ? sumEntry.total : recon.bookBalance;
            const bankBalance = recon.bankBalance != null ? Number(recon.bankBalance) : null;
            const difference = bankBalance != null ? bookBalance - bankBalance : bookBalance;

            await this.reconRepo.update(recon.id, {
                bookBalance,
                difference,
                // If difference became 0, auto-reconcile; if it moved away, un-reconcile
                status: Math.abs(difference) < 0.01 ? ReconciliationStatus.RECONCILED : recon.status === ReconciliationStatus.RECONCILED ? ReconciliationStatus.IN_PROGRESS : recon.status,
                reconciledBy: Math.abs(difference) < 0.01 ? 'Current User' : recon.status === ReconciliationStatus.RECONCILED ? null : recon.reconciledBy,
                reconciledAt: Math.abs(difference) < 0.01 ? new Date() : recon.status === ReconciliationStatus.RECONCILED ? null : recon.reconciledAt,
            });
        }
    }
}
