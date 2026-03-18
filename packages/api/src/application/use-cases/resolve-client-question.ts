import { ClientQuestionRepository, ImportedTransactionRepository, CloseTaskRepository, ClosePeriodRepository } from '../../domain/ports';

/**
 * ResolveClientQuestionUseCase
 *
 * Marks a client question as resolved, and if the question was linked to
 * a transaction (via vendor + amount match), reverts that transaction from
 * 'pending_client' status back to its appropriate state.
 * Updates close period task counts for accurate progress tracking.
 */
export class ResolveClientQuestionUseCase {
    constructor(
        private questionRepo: ClientQuestionRepository,
        private txnRepo: ImportedTransactionRepository,
        private taskRepo: CloseTaskRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) { }

    async execute(
        clientId: string,
        questionId: string,
        response: string,
    ): Promise<{ resolved: true }> {
        // Find the question before resolving so we can locate the linked transaction
        const questions = await this.questionRepo.findByClientId(clientId);
        const question = questions.find(q => q.id === questionId);

        // Resolve the question
        await this.questionRepo.resolve(questionId, response);

        // Revert linked transaction from 'pending_client' if applicable
        if (question && question.transactionVendor && question.transactionAmount !== 0) {
            const txns = await this.txnRepo.findByClosePeriodId(question.closePeriodId);
            const match = txns.find(t =>
                t.status === 'pending_client' &&
                t.vendor === question.transactionVendor &&
                Math.abs(t.amount - question.transactionAmount) < 0.01,
            );
            if (match) {
                const revertStatus = match.finalCategory ? 'categorized' : 'uncategorized';
                await this.txnRepo.updateCategory(match.id, match.finalCategory || '', revertStatus);
            }

            // After reverting a transaction, check auto-complete for categorization tasks
            await this.checkAutoCompleteAfterRevert(question.closePeriodId);
        }

        return { resolved: true };
    }

    /**
     * After reverting a transaction from pending_client, re-check if all
     * transactions are now categorized (auto-complete coding tasks).
     * NOTE: Questions themselves do NOT have an auto-complete rule —
     * users can always ask new questions at any time.
     */
    private async checkAutoCompleteAfterRevert(closePeriodId: string): Promise<void> {
        // Update task counts for accurate close progress
        const tasks = await this.taskRepo.findByClosePeriodId(closePeriodId);
        const completed = tasks.filter(t => t.status === 'complete').length;
        await this.closePeriodRepo.updateTaskCounts(closePeriodId, completed, tasks.length);
    }
}
