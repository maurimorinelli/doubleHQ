import { ReconciliationRepository, CloseTaskRepository, ClosePeriodRepository } from '../../domain/ports/index';
import { ReconciliationStatus } from '@doublehq/shared';

export class ReconcileAccountUseCase {
    constructor(
        private reconRepo: ReconciliationRepository,
        private taskRepo: CloseTaskRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) { }

    async execute(reconId: string, data: { bankBalance: number; notes?: string }): Promise<{ reconciled: boolean; difference: number }> {
        const recon = await this.reconRepo.findById(reconId);
        if (!recon) throw new Error('Reconciliation not found');

        const difference = recon.bookBalance - data.bankBalance;
        const isReconciled = Math.abs(difference) < 0.01;

        await this.reconRepo.update(reconId, {
            bankBalance: data.bankBalance,
            difference,
            status: isReconciled ? ReconciliationStatus.RECONCILED : ReconciliationStatus.IN_PROGRESS,
            reconciledBy: isReconciled ? 'Current User' : null,
            reconciledAt: isReconciled ? new Date() : null,
            notes: data.notes || recon.notes,
        });

        if (isReconciled) {
            await this.checkAutoComplete(recon.closePeriodId, recon.accountName);
        }

        return { reconciled: isReconciled, difference };
    }

    async reopen(reconId: string): Promise<void> {
        const recon = await this.reconRepo.findById(reconId);
        if (!recon) throw new Error('Reconciliation not found');

        await this.reconRepo.update(reconId, {
            status: ReconciliationStatus.IN_PROGRESS,
            reconciledBy: null,
            reconciledAt: null,
        });

        // Reverse the per-account auto-complete task
        const ruleName = this.getRuleForAccount(recon.accountName);
        const tasks = await this.taskRepo.findByClosePeriodId(recon.closePeriodId);
        const reconTask = tasks.find(t => t.autoCompleteRule === ruleName && t.status === 'complete');
        if (reconTask) {
            await this.taskRepo.updateStatus(reconTask.id, 'in_progress', null);
            const completed = tasks.filter(t => t.status === 'complete' && t.id !== reconTask.id).length;
            await this.closePeriodRepo.updateTaskCounts(recon.closePeriodId, completed, tasks.length);
        }
    }

    /** Map account name to the autoCompleteRule stored on the close task */
    private getRuleForAccount(accountName: string): string {
        const lower = accountName.toLowerCase();
        if (lower.includes('credit')) return 'cc_reconciled';
        return 'checking_reconciled';
    }

    private async checkAutoComplete(closePeriodId: string, accountName: string): Promise<void> {
        const ruleName = this.getRuleForAccount(accountName);
        const tasks = await this.taskRepo.findByClosePeriodId(closePeriodId);
        const task = tasks.find(t => t.autoCompleteRule === ruleName && t.status !== 'complete');

        if (task) {
            await this.taskRepo.updateStatus(task.id, 'complete', new Date());
            const completed = tasks.filter(t => t.status === 'complete').length + 1;
            await this.closePeriodRepo.updateTaskCounts(closePeriodId, completed, tasks.length);
        }
    }
}
