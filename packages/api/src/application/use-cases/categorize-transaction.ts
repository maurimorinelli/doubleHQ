import { ImportedTransactionRepository, CloseTaskRepository, ClosePeriodRepository } from '../../domain/ports';
import { ImportedTransaction } from '../../domain/entities';
import { TRANSACTION_CATEGORIES, createLogger } from '@doublehq/shared';
import Anthropic from '@anthropic-ai/sdk';

const logger = createLogger('CategorizeTransaction');

/** Shape of each suggestion returned by Claude's categorization response. */
interface AiCategorizationSuggestion {
    id: string;
    category: string;
    confidence: number;
}

export class CategorizeTransactionUseCase {
    private client: Anthropic;

    constructor(
        private txnRepo: ImportedTransactionRepository,
        private taskRepo: CloseTaskRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async execute(txnId: string, data: { finalCategory: string }): Promise<{ updated: boolean }> {
        const txn = await this.txnRepo.findById(txnId);
        if (!txn) throw new Error('Transaction not found');

        if (!data.finalCategory) {
            // Remove categorization — reset to uncategorized
            await this.txnRepo.updateCategory(txnId, '', 'uncategorized');
        } else {
            await this.txnRepo.updateCategory(txnId, data.finalCategory, 'categorized');
        }

        // Check auto-complete: if all transactions in this bank account are categorized
        await this.checkAutoComplete(txn.closePeriodId, txn.bankAccount);

        return { updated: true };
    }

    async acceptAllAiSuggestions(closePeriodId: string): Promise<{ count: number }> {
        const count = await this.txnRepo.updateAllWithAiSuggestions(closePeriodId);

        // Check auto-complete for both bank accounts
        await this.checkAutoComplete(closePeriodId, 'checking');
        await this.checkAutoComplete(closePeriodId, 'credit_card');

        return { count };
    }

    /** System-defined categories — AI MUST only use these */
    private static readonly SYSTEM_CATEGORIES: readonly string[] = TRANSACTION_CATEGORIES;

    /** AI Categorize All — calls Claude to suggest categories for uncategorized txns */
    async aiCategorizeAll(closePeriodId: string): Promise<{ categorized: number }> {
        const txns = await this.txnRepo.findByClosePeriodId(closePeriodId);
        const uncategorized = txns.filter(t => t.status === 'uncategorized');
        if (uncategorized.length === 0) return { categorized: 0 };

        const txnSummary = uncategorized.map(t => ({
            id: t.id,
            date: t.date,
            description: t.description,
            vendor: t.vendor,
            amount: t.amount,
            type: t.type,
        }));

        const categoriesList = CategorizeTransactionUseCase.SYSTEM_CATEGORIES.map(c => `"${c}"`).join(', ');

        const prompt = `You are an expert bookkeeper categorizing bank transactions.

Categorize each transaction into EXACTLY ONE of these system categories. You MUST use one of these exact category names — do NOT invent new categories:

${categoriesList}

Transactions to categorize:

${JSON.stringify(txnSummary, null, 2)}

For each transaction provide:
- id: the transaction ID
- category: MUST be one of the categories listed above (exact spelling)
- confidence: 0.0-1.0 confidence score

Return JSON:
{
  "suggestions": [
    { "id": "txn-id", "category": "Office Supplies", "confidence": 0.92 }
  ]
}

IMPORTANT: Every category MUST be one of the listed system categories. If unsure, use "Miscellaneous".
Respond with ONLY JSON. No markdown, no code blocks.`;

        try {
            const message = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = message.content[0].type === 'text' ? message.content[0].text : '{"suggestions":[]}';
            const data = JSON.parse(text);
            const suggestions = data.suggestions || [];

            // Validate: only accept system-defined categories
            const validSuggestions = suggestions.map((s: AiCategorizationSuggestion) => {
                const isValid = CategorizeTransactionUseCase.SYSTEM_CATEGORIES.includes(s.category);
                return {
                    ...s,
                    category: isValid ? s.category : 'Miscellaneous',
                    confidence: isValid ? s.confidence : 0.3,
                };
            });

            if (validSuggestions.length > 0) {
                const updates = validSuggestions.map((s: AiCategorizationSuggestion) => ({
                    id: s.id,
                    aiSuggestedCategory: s.category,
                    aiConfidence: s.confidence,
                }));
                await this.txnRepo.updateBulkAiSuggestions(updates);
                // Mark as categorized — same as manual. The AI badge in the UI is the indicator.
                for (const s of validSuggestions) {
                    await this.txnRepo.updateCategory(s.id, s.category, 'categorized');
                }
            }

            // Check auto-complete for both bank accounts after AI categorization
            await this.checkAutoComplete(closePeriodId, 'checking');
            await this.checkAutoComplete(closePeriodId, 'credit_card');

            return { categorized: validSuggestions.length };
        } catch (error) {
            logger.error('AI categorize failed, using fallback', error);
            return this.fallbackCategorize(closePeriodId, uncategorized);
        }
    }

    private async fallbackCategorize(closePeriodId: string, txns: ImportedTransaction[]): Promise<{ categorized: number }> {
        const vendorCategories: Record<string, string> = {
            'aws': 'Software Subscriptions', 'google': 'Software Subscriptions',
            'wework': 'Rent', 'regus': 'Rent',
            'gusto': 'Payroll', 'adp': 'Payroll',
            'staples': 'Office Supplies', 'delta': 'Travel', 'uber': 'Travel',
            'facebook': 'Marketing', 'at&t': 'Utilities', 'comcast': 'Utilities',
            'ups': 'Postage & Shipping', 'fedex': 'Postage & Shipping',
        };

        const updates = txns.map(t => {
            const vendorLower = (t.vendor || '').toLowerCase();
            const matchedKey = Object.keys(vendorCategories).find(k => vendorLower.includes(k));
            return {
                id: t.id,
                aiSuggestedCategory: matchedKey ? vendorCategories[matchedKey] : 'Miscellaneous',
                aiConfidence: matchedKey ? 0.75 : 0.4,
            };
        });

        await this.txnRepo.updateBulkAiSuggestions(updates);
        // Mark as categorized — same as manual
        for (const u of updates) {
            await this.txnRepo.updateCategory(u.id, u.aiSuggestedCategory, 'categorized');
        }

        // Check auto-complete after fallback categorization
        await this.checkAutoComplete(closePeriodId, 'checking');
        await this.checkAutoComplete(closePeriodId, 'credit_card');

        return { categorized: updates.length };
    }

    private async checkAutoComplete(closePeriodId: string, bankAccount: string): Promise<void> {
        const tasks = await this.taskRepo.findByClosePeriodId(closePeriodId);

        // Check per-bank-account rules
        const counts = await this.txnRepo.countByClosePeriodAndStatus(closePeriodId, bankAccount);
        if (counts.total > 0 && counts.total === counts.categorized) {
            const ruleName = bankAccount === 'checking' ? 'all_transactions_categorized' : 'all_cc_categorized';
            const task = tasks.find(t => t.autoCompleteRule === ruleName && t.status !== 'complete');
            if (task) {
                await this.taskRepo.updateStatus(task.id, 'complete', new Date());
            }
        }

        // Check if ALL transactions (across all bank accounts) are categorized
        const checkingCounts = await this.txnRepo.countByClosePeriodAndStatus(closePeriodId, 'checking');
        const ccCounts = await this.txnRepo.countByClosePeriodAndStatus(closePeriodId, 'credit_card');
        const totalAll = checkingCounts.total + ccCounts.total;
        const categorizedAll = checkingCounts.categorized + ccCounts.categorized;
        if (totalAll > 0 && totalAll === categorizedAll) {
            // Auto-complete the "Code bank transactions" task
            const allTxnTask = tasks.find(t => t.autoCompleteRule === 'all_transactions_categorized' && t.status !== 'complete');
            if (allTxnTask) {
                await this.taskRepo.updateStatus(allTxnTask.id, 'complete', new Date());
            }
            // Also auto-complete CC categorization task
            const ccTask = tasks.find(t => t.autoCompleteRule === 'all_cc_categorized' && t.status !== 'complete');
            if (ccTask) {
                await this.taskRepo.updateStatus(ccTask.id, 'complete', new Date());
            }
            // Auto-complete "Review uncategorized transactions" task
            const uncatTask = tasks.find(t => t.autoCompleteRule === 'no_uncategorized_remaining' && t.status !== 'complete');
            if (uncatTask) {
                await this.taskRepo.updateStatus(uncatTask.id, 'complete', new Date());
            }
        }

        // Update close period task counts
        const updatedTasks = await this.taskRepo.findByClosePeriodId(closePeriodId);
        const completed = updatedTasks.filter(t => t.status === 'complete').length;
        await this.closePeriodRepo.updateTaskCounts(closePeriodId, completed, updatedTasks.length);
    }
}
