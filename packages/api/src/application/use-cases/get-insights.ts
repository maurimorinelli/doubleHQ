import type { InsightsResponse, InsightItem } from '@doublehq/shared';
import { InsightCategory, createLogger } from '@doublehq/shared';
import { CachedInsightRepository, InsightGenerator } from '../../domain/ports';

const logger = createLogger('Insights');

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

export class GetInsightsUseCase {
    constructor(
        private cachedInsightRepo: CachedInsightRepository,
        private insightGenerator: InsightGenerator | null,
    ) { }

    async execute(firmId: string): Promise<InsightsResponse> {
        const cached = await this.cachedInsightRepo.findLatestByFirmId(firmId);

        if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
            return {
                lastUpdated: new Date(cached.generatedAt).toISOString(),
                source: 'ai',
                insights: cached.insights as InsightItem[],
            };
        }

        // Return cached even if expired — frontend can trigger refresh
        if (cached) {
            return {
                lastUpdated: new Date(cached.generatedAt).toISOString(),
                source: 'ai',
                insights: cached.insights as InsightItem[],
            };
        }

        // No cache at all — return template insights
        return {
            lastUpdated: new Date().toISOString(),
            source: 'template',
            insights: this.getTemplateInsights(),
        };
    }

    private getTemplateInsights(): InsightItem[] {
        return [
            {
                id: 'template_001',
                category: InsightCategory.URGENT,
                title: 'AI insights not yet generated',
                description: 'Click "Refresh Insights" to generate AI-powered insights based on your current close data.',
                affectedClient: null,
                affectedTeamMember: null,
                recommendedAction: 'Click the refresh button to generate insights',
                metrics: {},
            },
        ];
    }
}

export class RefreshInsightsUseCase {
    constructor(
        private cachedInsightRepo: CachedInsightRepository,
        private insightGenerator: InsightGenerator | null,
        private buildPrompt: (firmId: string) => Promise<string>,
    ) { }

    async execute(firmId: string): Promise<InsightsResponse> {
        // If no AI generator configured, use template
        if (!this.insightGenerator) {
            return {
                lastUpdated: new Date().toISOString(),
                source: 'template',
                insights: this.getFallbackInsights(),
            };
        }

        try {
            const prompt = await this.buildPrompt(firmId);
            const result = await this.insightGenerator.generate(prompt);

            const { createHash } = await import('crypto');
            const promptHash = createHash('sha256').update(prompt).digest('hex');
            const now = new Date();

            const saved = await this.cachedInsightRepo.save({
                firmId,
                insights: result.insights,
                generatedAt: now,
                expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
                promptHash,
                model: 'gpt-4',
                tokenCount: result.tokenCount,
            });

            return {
                lastUpdated: now.toISOString(),
                source: 'ai',
                insights: saved.insights as InsightItem[],
            };
        } catch (err) {
            logger.error('AI insight generation failed', err);
            return {
                lastUpdated: new Date().toISOString(),
                source: 'template',
                insights: this.getFallbackInsights(),
            };
        }
    }

    private getFallbackInsights(): InsightItem[] {
        return [
            {
                id: 'fallback_001',
                category: InsightCategory.INSIGHT,
                title: 'AI temporarily unavailable',
                description: 'AI-generated insights are temporarily unavailable. Showing rule-based insights. Please try again later.',
                affectedClient: null,
                affectedTeamMember: null,
                recommendedAction: 'Try refreshing again in a few minutes',
                metrics: {},
            },
        ];
    }
}
