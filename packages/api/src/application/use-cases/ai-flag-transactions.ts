import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuid } from 'uuid';
import { createLogger, FlagType } from '@doublehq/shared';
import { ImportedTransaction } from '../../domain/entities';

const logger = createLogger('AiFlagTransactions');

/** Shape of each flag returned by Claude's flagging response. */
interface AiFlagSuggestion {
    id: string;
    type: string;
    description: string;
}
import {
    ImportedTransactionRepository,
    TransactionFlagRepository,
    ClosePeriodRepository,
} from '../../domain/ports';

// ─── AI Flag Transactions Use Case ───────────────────────────────────────────
// Sends transactions to Claude to identify suspicious ones, saves flags

export class AiFlagTransactionsUseCase {
    private client: Anthropic;

    constructor(
        private txnRepo: ImportedTransactionRepository,
        private flagRepo: TransactionFlagRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async execute(clientId: string, closePeriodId: string): Promise<{ flagged: number }> {
        const closePeriod = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!closePeriod) throw new Error('No active close period');

        // Clear existing flags so re-running produces a fresh evaluation
        await this.flagRepo.deleteByClosePeriodId(closePeriod.id);

        // Reset any previously-flagged transactions back to uncategorized
        const txns = await this.txnRepo.findByClosePeriodId(closePeriod.id);
        for (const t of txns) {
            if (t.status === 'flagged') {
                await this.txnRepo.updateCategory(t.id, t.finalCategory || '', 'uncategorized');
            }
        }

        const freshTxns = await this.txnRepo.findByClosePeriodId(closePeriod.id);
        if (freshTxns.length === 0) return { flagged: 0 };

        const txnSummary = freshTxns.map(t => ({
            id: t.id,
            date: t.date,
            description: t.description,
            vendor: t.vendor,
            amount: t.amount,
            type: t.type,
            bankAccount: t.bankAccount,
        }));

        const prompt = `You are an expert bookkeeper reviewing imported bank transactions for suspicious activity.

Analyze these transactions and identify any that should be flagged for review:

${JSON.stringify(txnSummary, null, 2)}

For each suspicious transaction, provide:
- id: the transaction ID
- type: one of "unusual_amount", "duplicate_vendor", "new_vendor", "out_of_pattern", "missing_info"
- description: brief explanation of why it's flagged

Return a JSON object like:
{
  "flags": [
    { "id": "txn-id", "type": "unusual_amount", "description": "Amount is 5x typical for this vendor" }
  ]
}

Flag 2-5 transactions. Be selective — only flag genuinely suspicious items.
Respond with ONLY JSON. No markdown, no code blocks.`;

        try {
            const message = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [{ role: 'user', content: prompt }],
            });

            const rawText = message.content[0].type === 'text' ? message.content[0].text : '{"flags":[]}';
            // Strip markdown code fences if present
            const cleanText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
            const data = JSON.parse(cleanText);
            const flags = data.flags || [];

            if (flags.length > 0) {
                const flagEntities = flags.map((f: AiFlagSuggestion) => {
                    const txn = freshTxns.find(t => t.id === f.id);
                    return {
                        id: uuid(),
                        clientId,
                        closePeriodId: closePeriod.id,
                        transactionId: f.id,
                        type: (f.type || 'ai_flagged') as FlagType,
                        description: f.description || 'Flagged by AI',
                        amount: txn?.amount || 0,
                        transactionDate: txn?.date || new Date(),
                        vendor: txn?.vendor || 'Unknown',
                        accountCoded: null,
                        suggestedAccount: null,
                        isResolved: false,
                        resolvedAt: null,
                        resolvedBy: null,
                        flaggedAt: new Date(),
                    };
                });

                await this.flagRepo.saveBatch(flagEntities);

                // Update transaction statuses to 'flagged'
                for (const f of flags) {
                    const txn = txns.find(t => t.id === f.id);
                    if (txn && txn.status !== 'flagged') {
                        await this.txnRepo.updateCategory(f.id, txn.finalCategory || '', 'flagged');
                    }
                }
            }

            return { flagged: flags.length };
        } catch (error) {
            logger.error('AI flag failed, using fallback', error);
            return this.fallbackFlag(clientId, closePeriod.id, freshTxns);
        }
    }

    private async fallbackFlag(clientId: string, closePeriodId: string, txns: ImportedTransaction[]): Promise<{ flagged: number }> {
        // Flag the top 3 highest-amount transactions as suspicious
        const sorted = [...txns]
            .filter(t => t.status === 'uncategorized')
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3);

        if (sorted.length === 0) return { flagged: 0 };

        const flags = sorted.map(txn => ({
            id: uuid(),
            clientId,
            closePeriodId,
            type: FlagType.UNUSUAL_AMOUNT,
            description: `Unusually high amount of $${txn.amount.toFixed(2)} for ${txn.vendor}`,
            amount: txn.amount,
            transactionDate: txn.date,
            vendor: txn.vendor,
            accountCoded: null,
            suggestedAccount: null,
            isResolved: false,
            resolvedAt: null,
            resolvedBy: null,
            flaggedAt: new Date(),
        }));

        await this.flagRepo.saveBatch(flags);
        for (const txn of sorted) {
            await this.txnRepo.updateCategory(txn.id, '', 'flagged');
        }

        return { flagged: flags.length };
    }

    /** Manually flag a single transaction */
    async manualFlag(clientId: string, txnId: string, reason: string): Promise<{ flagged: boolean }> {
        const txn = await this.txnRepo.findById(txnId);
        if (!txn) throw new Error('Transaction not found');

        const closePeriod = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!closePeriod) throw new Error('No active close period');

        await this.flagRepo.saveBatch([{
            id: uuid(),
            clientId,
            closePeriodId: closePeriod.id,
            transactionId: txnId,
            type: 'manual' as FlagType,
            description: reason,
            amount: txn.amount,
            transactionDate: txn.date,
            vendor: txn.vendor,
            accountCoded: null,
            suggestedAccount: null,
            isResolved: false,
            resolvedAt: null,
            resolvedBy: null,
            flaggedAt: new Date(),
        }]);

        if (txn.status !== 'flagged') {
            await this.txnRepo.updateCategory(txnId, txn.finalCategory || '', 'flagged');
        }

        return { flagged: true };
    }

    /** Unflag a transaction — reset its status and resolve associated flags */
    async unflag(clientId: string, txnId: string): Promise<{ unflagged: boolean }> {
        const txn = await this.txnRepo.findById(txnId);
        if (!txn) throw new Error('Transaction not found');

        // Reset transaction status to uncategorized (or categorized if it has a category)
        const newStatus = txn.finalCategory ? 'categorized' : 'uncategorized';
        await this.txnRepo.updateCategory(txnId, txn.finalCategory || '', newStatus);

        // Resolve flags matching this transaction (by ID for reliability, with vendor+amount fallback)
        const resolved = await this.flagRepo.resolveByTransactionId(clientId, txnId);
        if (resolved === 0) {
            // Fallback for older flags that don't have transactionId
            await this.flagRepo.resolveByVendorAndAmount(clientId, txn.vendor, txn.amount);
        }

        return { unflagged: true };
    }
}
