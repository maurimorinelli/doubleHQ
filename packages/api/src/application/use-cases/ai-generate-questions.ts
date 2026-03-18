import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuid } from 'uuid';
import { createLogger, QuestionCategory, QuestionStatus } from '@doublehq/shared';
import { ImportedTransaction } from '../../domain/entities';

const logger = createLogger('AiGenerateQuestions');

/** Shape of each question returned by Claude's question-generation response. */
interface AiQuestionSuggestion {
    id: string;
    question: string;
}
import {
    ImportedTransactionRepository,
    ClientQuestionRepository,
    ClosePeriodRepository,
} from '../../domain/ports';

// ─── AI Generate Questions Use Case ──────────────────────────────────────────
// Sends transactions to Claude to generate clarification questions, saves via question repo

export class AiGenerateQuestionsUseCase {
    private client: Anthropic;

    constructor(
        private txnRepo: ImportedTransactionRepository,
        private questionRepo: ClientQuestionRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async execute(clientId: string, closePeriodId: string): Promise<{ questions: number }> {
        const closePeriod = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!closePeriod) throw new Error('No active close period');

        const txns = await this.txnRepo.findByClosePeriodId(closePeriod.id);
        // Send all transactions that don't already have a pending client question.
        // AI categorization doesn't remove the need for client clarification.
        const candidates = txns.filter(t => t.status !== 'pending_client');
        if (candidates.length === 0) return { questions: 0 };

        const txnSummary = candidates.map(t => ({
            id: t.id,
            date: t.date,
            description: t.description,
            vendor: t.vendor,
            amount: t.amount,
            type: t.type,
        }));

        const prompt = `You are an expert bookkeeper preparing questions for a client about ambiguous transactions.

These transactions need clarification from the client:

${JSON.stringify(txnSummary, null, 2)}

For each transaction you want to ask about, provide:
- id: the transaction ID
- question: a clear, professional question to ask the client

Return a JSON object like:
{
  "questions": [
    { "id": "txn-id", "question": "Could you clarify the purpose of this $500.00 charge from Staples on Jan 15? Was this for office supplies or equipment?" }
  ]
}

Generate 3-5 questions for the most ambiguous transactions only.
Respond with ONLY JSON. No markdown, no code blocks.`;

        try {
            const message = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = message.content[0].type === 'text' ? message.content[0].text : '{"questions":[]}';
            const data = JSON.parse(text);
            const questions = data.questions || [];

            for (const q of questions as AiQuestionSuggestion[]) {
                const txn = candidates.find(t => t.id === q.id);
                if (!txn) continue;

                await this.questionRepo.save({
                    id: uuid(),
                    closePeriodId: closePeriod.id,
                    clientId,
                    question: q.question,
                    category: QuestionCategory.TRANSACTION_CLARIFICATION,
                    transactionAmount: txn.amount,
                    transactionDate: txn.date,
                    transactionVendor: txn.vendor,
                    sentAt: new Date(),
                    status: QuestionStatus.PENDING,
                });

                // Mark transaction as pending_client
                await this.txnRepo.updateCategory(txn.id, txn.finalCategory || '', 'pending_client');
            }

            return { questions: questions.length };
        } catch (error) {
            logger.error('AI question generation failed, using fallback', error);
            return this.fallbackGenerate(clientId, closePeriod.id, candidates);
        }
    }

    private async fallbackGenerate(clientId: string, closePeriodId: string, txns: ImportedTransaction[]): Promise<{ questions: number }> {
        const selected = txns.slice(0, 3);
        for (const txn of selected) {
            await this.questionRepo.save({
                id: uuid(),
                closePeriodId,
                clientId,
                question: `Could you please clarify the purpose of this $${txn.amount.toFixed(2)} ${txn.type} from ${txn.vendor} on ${new Date(txn.date).toLocaleDateString()}?`,
                category: QuestionCategory.TRANSACTION_CLARIFICATION,
                transactionAmount: txn.amount,
                transactionDate: txn.date,
                transactionVendor: txn.vendor,
                sentAt: new Date(),
                status: QuestionStatus.PENDING,
            });
            await this.txnRepo.updateCategory(txn.id, txn.finalCategory || '', 'pending_client');
        }
        return { questions: selected.length };
    }
}
