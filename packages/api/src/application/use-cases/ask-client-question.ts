import { ClientQuestionRepository, ImportedTransactionRepository, ClosePeriodRepository } from '../../domain/ports/index';
import { v4 as uuid } from 'uuid';
import { QuestionCategory, QuestionStatus } from '@doublehq/shared';

export class AskClientQuestionUseCase {
    constructor(
        private questionRepo: ClientQuestionRepository,
        private txnRepo: ImportedTransactionRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) { }

    async execute(clientId: string, txnId: string, data: { question: string }): Promise<{ questionId: string }> {
        const txn = await this.txnRepo.findById(txnId);
        if (!txn) throw new Error('Transaction not found');

        // Update transaction status to pending_client
        await this.txnRepo.updateCategory(txnId, txn.finalCategory || txn.aiSuggestedCategory || '', 'pending_client');

        // Find the close period
        const closePeriod = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!closePeriod) throw new Error('No active close period');

        // Create the question
        const questionId = uuid();
        await this.questionRepo.save({
            id: questionId,
            closePeriodId: closePeriod.id,
            clientId,
            question: data.question,
            category: QuestionCategory.TRANSACTION_CLARIFICATION,
            transactionAmount: txn.amount,
            transactionDate: txn.date,
            transactionVendor: txn.vendor,
            sentAt: new Date(),
            status: QuestionStatus.PENDING,
        });

        return { questionId };
    }

    async createGenericQuestion(clientId: string, data: { question: string; category?: string }): Promise<{ questionId: string }> {
        // Find the close period
        const closePeriod = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!closePeriod) throw new Error('No active close period');

        const questionId = uuid();
        await this.questionRepo.save({
            id: questionId,
            closePeriodId: closePeriod.id,
            clientId,
            question: data.question,
            category: (data.category || 'general') as QuestionCategory,
            transactionAmount: 0,
            transactionDate: new Date(),
            transactionVendor: '',
            sentAt: new Date(),
            status: QuestionStatus.PENDING,
        });

        return { questionId };
    }
}
