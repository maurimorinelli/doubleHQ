import Anthropic from '@anthropic-ai/sdk';
import { InsightGenerator } from '../../domain/ports';
import { createLogger } from '@doublehq/shared';

const logger = createLogger('ClaudeInsightGenerator');

/**
 * Claude-powered Insight Generator
 *
 * Receives a pre-built prompt containing pre-computed metrics (not raw data)
 * and asks Claude to narrate, prioritize, and categorize the insights.
 *
 * Design principle: AI is a WRITER, not a CALCULATOR.
 * All numbers in the prompt are already computed by the backend.
 */
export class ClaudeInsightGenerator implements InsightGenerator {
    private client: Anthropic;

    constructor() {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async generate(prompt: string): Promise<{ insights: unknown[]; tokenCount: number }> {
        const systemPrompt = `You are a senior bookkeeping operations analyst at a practice management firm.
Your job is to analyze the current state of all active month-end closes and generate actionable insights for the firm manager.

You will receive a JSON snapshot of the firm's current close status. Based on this data, generate 4-8 insights categorized as follows:

Categories:
- "urgent" — Critical items needing immediate action (overdue closes, zero-progress clients near deadline, team members with no activity)
- "at_risk" — Clients with issues that could become urgent soon (pending client questions, blocked tasks, approaching deadlines with low progress)
- "insight" — Workload patterns and optimization opportunities (uneven team distribution, capacity suggestions, efficiency patterns)
- "win" — Positive trends and achievements (completed closes, improved close times, high-performing team members)

Rules:
1. ALWAYS use the exact numbers from the data — never invent or estimate numbers.
2. Reference specific client names, team member names, and dates from the data.
3. Each insight must have a clear, specific recommended action.
4. Prioritize urgency: generate at least 1-2 urgent/at_risk insights if the data supports it.
5. Include at least 1 win if any client has completed their close or is ahead of schedule.
6. Keep titles short and scannable (under 12 words).
7. Descriptions should be 1-3 sentences with specific facts.
8. Recommended actions should be concrete (not vague like "look into it").

Respond with ONLY a JSON array. No markdown, no code blocks, no explanation.

Each insight must match this schema:
{
  "id": "unique_string",
  "category": "urgent" | "at_risk" | "insight" | "win",
  "title": "Short descriptive title",
  "description": "Detailed description with specific data points",
  "affectedClient": { "id": "client_id", "name": "Client Name" } | null,
  "affectedTeamMember": { "id": "member_id", "name": "Member Name" } | null,
  "recommendedAction": "Specific action to take",
  "metrics": { "key": "value" }
}`;

        try {
            const message = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                temperature: 0.1,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
            const tokenCount = (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0);

            // Parse the response — handle potential JSON wrapped in markdown
            let cleanText = text.trim();
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            const insights = JSON.parse(cleanText);

            if (!Array.isArray(insights)) {
                logger.warn('AI returned non-array response, wrapping', { type: typeof insights });
                return { insights: [insights], tokenCount };
            }

            return { insights, tokenCount };
        } catch (error) {
            logger.error('Claude insight generation failed', error);
            throw error; // Let the use case handle fallback
        }
    }
}
