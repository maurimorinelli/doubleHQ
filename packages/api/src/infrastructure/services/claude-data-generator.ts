import Anthropic from '@anthropic-ai/sdk';
import {
    AiDataGenerator,
    GeneratedTransaction,
} from '../../domain/services/ai-data-generator.port';
import { createLogger } from '@doublehq/shared';

const logger = createLogger('ClaudeDataGenerator');

// ─── Claude Data Generator ───────────────────────────────────────────────────
// Calls Claude to generate realistic RAW transaction data for new clients.
// Transactions arrive uncategorized — AI categorization happens later via buttons.

export class ClaudeDataGenerator implements AiDataGenerator {
    private client: Anthropic;

    constructor() {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async generateClientData(context: {
        clientName: string;
        industry: string;
        monthlyRevenue: number;
        accountType: string;
        period: string;
    }): Promise<{
        transactions: GeneratedTransaction[];
    }> {
        const [year, month] = context.period.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        const prompt = `You are an AI that generates realistic raw bank-feed transaction data for a bookkeeping application.

Generate data for:
- Company: "${context.clientName}"
- Industry: ${context.industry}
- Monthly Revenue: $${context.monthlyRevenue.toLocaleString()}
- Accounting Method: ${context.accountType}
- Period: ${context.period} (${daysInMonth} days)

Generate a JSON object with NO extra text:

{
  "transactions": [
    // 15-20 realistic raw transactions for this period
    // These are BANK FEED imports — raw, uncategorized data.
    // Mix of debit and credit. Vendors should be real, recognizable names for the industry.
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "vendor": "string",
      "amount": number,
      "type": "debit" | "credit",
      "bankAccount": "checking" | "credit_card"
    }
  ]
}

Rules:
- Amounts should be proportional to the monthly revenue
- Dates must be within ${context.period}-01 to ${context.period}-${String(daysInMonth).padStart(2, '0')}
- Use realistic vendor names for the "${context.industry}" industry
- Include at least one payroll-like transaction and one rent/lease
- Include a mix of routine and unusual transactions

Respond with ONLY the JSON. No markdown, no code blocks, no explanation.`;

        try {
            const message = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = message.content[0].type === 'text' ? message.content[0].text : '';
            const data = JSON.parse(text);

            return {
                transactions: data.transactions || [],
            };
        } catch (error) {
            logger.error('Claude data generation failed, using fallback', error);
            return this.fallbackGenerate(context);
        }
    }

    // ─── Fallback: deterministic data if Claude API fails ────────────────────
    private fallbackGenerate(context: {
        clientName: string;
        industry: string;
        monthlyRevenue: number;
        period: string;
    }): {
        transactions: GeneratedTransaction[];
    } {
        const [year, month] = context.period.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const rev = context.monthlyRevenue;

        const vendors = [
            'Amazon Web Services', 'Google Workspace', 'WeWork',
            'Gusto Payroll', 'Staples', 'Delta Airlines',
            'Uber', 'Facebook Ads', 'AT&T', 'UPS',
            'Comcast', 'FedEx', 'Home Depot', 'Costco',
            'Adobe', 'Slack Technologies', 'DocuSign', 'Zoom',
        ];

        const transactions: GeneratedTransaction[] = [];
        for (let i = 0; i < 18; i++) {
            const day = Math.min(Math.floor(Math.random() * daysInMonth) + 1, daysInMonth);
            const vendor = vendors[i % vendors.length];
            const amount = Math.round((rev * (0.01 + Math.random() * 0.08)) * 100) / 100;
            const isCredit = Math.random() > 0.8;
            transactions.push({
                date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                description: `${isCredit ? 'Payment from' : 'Payment to'} ${vendor}`,
                vendor,
                amount,
                type: isCredit ? 'credit' : 'debit',
                bankAccount: Math.random() > 0.3 ? 'checking' : 'credit_card',
            });
        }

        return { transactions };
    }
}
