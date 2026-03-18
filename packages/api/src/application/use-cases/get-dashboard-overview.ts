import { HealthStatus, ClosePeriodStatus, CLOSE_SECTION_LABELS, CLOSE_SECTION_ORDER } from '@doublehq/shared';
import { computeHealthStatusOverride } from '../../domain/services/close-status.service';
import type { DashboardOverviewResponse, DashboardClientItem, DashboardSummary } from '@doublehq/shared';
import {
    ClosePeriodRepository,
    ClientRepository,
    CloseTaskRepository,
    ClientQuestionRepository,
    TransactionFlagRepository,
} from '../../domain/ports';
import { HealthScoreService } from '../../domain/services/health-score.service';

export class GetDashboardOverviewUseCase {
    constructor(
        private closePeriodRepo: ClosePeriodRepository,
        private clientRepo: ClientRepository,
        private questionRepo: ClientQuestionRepository,
        private flagRepo: TransactionFlagRepository,
        private healthScoreService: HealthScoreService,
    ) { }

    async execute(firmId: string, period?: string, filters?: { status?: string[]; assignee?: string; sort?: string }): Promise<DashboardOverviewResponse> {
        const closePeriods = await this.closePeriodRepo.findActiveByFirmId(firmId, period);

        const clients: DashboardClientItem[] = [];

        for (const cp of closePeriods) {
            const { client, preparer, reviewer } = cp;

            if (!client) continue;

            const daysRemaining = Math.floor(
                (new Date(cp.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );

            const progress = cp.totalTasks > 0
                ? Math.round((cp.completedTasks / cp.totalTasks) * 1000) / 10
                : 0;

            // Real-time health status override (logic extracted to close-status.service.ts)
            const healthStatus = computeHealthStatusOverride({
                storedHealthStatus: cp.healthStatus,
                closePeriodStatus: cp.status,
                daysRemaining,
                totalTasks: cp.totalTasks,
                completedTasks: cp.completedTasks,
            });

            clients.push({
                id: client.id,
                name: client.name,
                industry: client.industry,
                period: cp.period,
                progress,
                healthScore: cp.healthScore,
                healthStatus,
                daysRemaining,
                isOverdue: daysRemaining < 0 && cp.status !== ClosePeriodStatus.CLOSED,
                totalTasks: cp.totalTasks,
                completedTasks: cp.completedTasks,
                blockedTasks: cp.blockedTasks,
                pendingQuestions: 0, // Will be enriched below
                preparer: {
                    id: preparer?.id || cp.preparerId,
                    name: preparer?.name || 'Unknown',
                    initials: this.getInitials(preparer?.name || 'U'),
                },
                reviewer: {
                    id: reviewer?.id || cp.reviewerId,
                    name: reviewer?.name || 'Unknown',
                    initials: this.getInitials(reviewer?.name || 'U'),
                },
            });
        }

        // Apply filters
        let filtered = clients;
        if (filters?.status && filters.status.length > 0) {
            filtered = filtered.filter(c => filters.status!.includes(c.healthStatus));
        }
        if (filters?.assignee) {
            filtered = filtered.filter(c => c.preparer.id === filters.assignee);
        }

        // Sort
        const sort = filters?.sort || 'health_asc';
        switch (sort) {
            case 'health_desc':
                filtered.sort((a, b) => b.healthScore - a.healthScore);
                break;
            case 'name_asc':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'due_date_asc':
                filtered.sort((a, b) => a.daysRemaining - b.daysRemaining);
                break;
            default: // health_asc (worst first)
                filtered.sort((a, b) => a.healthScore - b.healthScore);
        }

        const summary: DashboardSummary = {
            total: clients.length,
            onTrack: clients.filter(c => c.healthStatus === HealthStatus.ON_TRACK).length,
            atRisk: clients.filter(c => c.healthStatus === HealthStatus.AT_RISK).length,
            behind: clients.filter(c => c.healthStatus === HealthStatus.BEHIND).length,
            notStarted: clients.filter(c => c.healthStatus === HealthStatus.NOT_STARTED).length,
            period: period || 'All',
        };

        return { summary, clients: filtered };
    }

    private getInitials(name: string): string {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
}
