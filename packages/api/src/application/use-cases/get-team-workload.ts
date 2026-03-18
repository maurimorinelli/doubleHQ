import { CapacityStatus, ClosePeriodStatus, HealthStatus } from '@doublehq/shared';
import type { TeamWorkloadResponse, TeamMemberItem, RebalanceSuggestion } from '@doublehq/shared';
import { TeamMemberRepository, ClosePeriodRepository } from '../../domain/ports';
import { computeCapacity } from '../../domain/services/close-status.service';

export class GetTeamWorkloadUseCase {
    constructor(
        private teamMemberRepo: TeamMemberRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) { }

    async execute(firmId: string, period: string): Promise<TeamWorkloadResponse> {
        const [teamMembers, closePeriods] = await Promise.all([
            this.teamMemberRepo.findByFirmId(firmId),
            // Fetch ALL active close periods (no period filter) so overdue
            // closes from previous months appear on team member cards
            this.closePeriodRepo.findActiveByFirmId(firmId),
        ]);

        const members: TeamMemberItem[] = teamMembers
            .map(tm => {
                // Count closes where this member is either preparer OR reviewer
                const memberCloses = closePeriods.filter(
                    cp => cp.preparerId === tm.id || cp.reviewerId === tm.id
                );

                const statusBreakdown = {
                    onTrack: memberCloses.filter(cp => cp.healthStatus === HealthStatus.ON_TRACK).length,
                    atRisk: memberCloses.filter(cp => cp.healthStatus === HealthStatus.AT_RISK).length,
                    behind: memberCloses.filter(cp => cp.healthStatus === HealthStatus.BEHIND).length,
                    completed: memberCloses.filter(cp => cp.status === ClosePeriodStatus.CLOSED).length,
                };

                const capacityStatus = computeCapacity(memberCloses.length, statusBreakdown.behind);

                // Compute avg close time from completed ones
                const completedCloses = memberCloses.filter(cp => cp.status === ClosePeriodStatus.CLOSED);
                const avgCloseTime = completedCloses.length > 0
                    ? Math.round(completedCloses.reduce((sum, cp) => sum + cp.previousCloseTime, 0) / completedCloses.length * 10) / 10
                    : 0;

                return {
                    id: tm.id,
                    name: tm.name,
                    role: tm.role,
                    initials: tm.name.split(' ').map(n => n[0]).join('').toUpperCase(),
                    clientCount: memberCloses.length,
                    capacityStatus,
                    averageCloseTime: avgCloseTime,
                    statusBreakdown,
                    clients: memberCloses.map(cp => {
                        return {
                            id: cp.client?.id || cp.clientId,
                            name: cp.client?.name || 'Unknown',
                            healthStatus: cp.healthStatus,
                        };
                    }),
                };
            });

        // Generate rebalance suggestions
        const rebalanceSuggestions = this.generateRebalanceSuggestions(members);

        const totalCompleted = closePeriods.filter(cp => cp.status === ClosePeriodStatus.CLOSED).length;

        return {
            period,
            summary: {
                totalMembers: members.length,
                totalActiveCloses: closePeriods.length,
                totalCompleted,
            },
            members,
            rebalanceSuggestions,
        };
    }

    // computeCapacity extracted to close-status.service.ts

    private generateRebalanceSuggestions(members: TeamMemberItem[]): RebalanceSuggestion[] {
        const suggestions: RebalanceSuggestion[] = [];

        const overloaded = members.filter(m => m.capacityStatus === CapacityStatus.OVERLOADED);
        const available = members.filter(m =>
            m.capacityStatus === CapacityStatus.BALANCED || m.capacityStatus === CapacityStatus.AVAILABLE
        );

        for (const from of overloaded) {
            if (available.length === 0) break;

            // Find worst-health client to move
            const worstClient = from.clients
                .filter(c => c.healthStatus === HealthStatus.BEHIND || c.healthStatus === HealthStatus.AT_RISK)
                .sort((a, b) => {
                    const order = { behind: 0, at_risk: 1, not_started: 2, on_track: 3 };
                    return (order[a.healthStatus] ?? 3) - (order[b.healthStatus] ?? 3);
                })[0];

            if (!worstClient) continue;

            const to = available[0];
            suggestions.push({
                suggestion: `${from.name} has ${from.statusBreakdown.behind + from.statusBreakdown.atRisk} at-risk clients. ${to.name} has availability. Consider reassigning ${worstClient.name} to ${to.name}.`,
                fromMember: { id: from.id, name: from.name },
                toMember: { id: to.id, name: to.name },
                client: { id: worstClient.id, name: worstClient.name },
            });
        }

        return suggestions;
    }
}
