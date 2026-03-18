import { TeamMemberRepository, ClosePeriodRepository } from '../../domain/ports';

interface AssignmentSuggestion {
    id: string;
    name: string;
    activeCloses: number;
}

export interface SuggestTeamAssignmentResult {
    suggestedPreparer: AssignmentSuggestion | null;
    suggestedReviewer: AssignmentSuggestion | null;
}

/**
 * SuggestTeamAssignmentUseCase
 *
 * Analyzes team workload and suggests the least-loaded
 * preparer and reviewer for a new close assignment.
 */
export class SuggestTeamAssignmentUseCase {
    constructor(
        private teamMemberRepo: TeamMemberRepository,
        private closePeriodRepo: ClosePeriodRepository,
    ) { }

    async execute(firmId: string): Promise<SuggestTeamAssignmentResult> {
        const members = await this.teamMemberRepo.findByFirmId(firmId);
        const closePeriods = await this.closePeriodRepo.findActiveByFirmId(firmId);

        // Count active closes per team member
        const workload = new Map<string, number>();
        for (const m of members) workload.set(m.id, 0);
        for (const cp of closePeriods) {
            workload.set(cp.preparerId, (workload.get(cp.preparerId) || 0) + 1);
        }

        // Sort by least-loaded
        const preparers = members
            .filter(m => m.role === 'preparer')
            .sort((a, b) => (workload.get(a.id) || 0) - (workload.get(b.id) || 0));

        const reviewers = members
            .filter(m => m.role === 'manager' || m.role === 'reviewer')
            .sort((a, b) => (workload.get(a.id) || 0) - (workload.get(b.id) || 0));

        const suggestedPreparer = preparers[0] || members[0];
        const suggestedReviewer = reviewers[0] || members.find(m => m.id !== suggestedPreparer?.id) || members[0];

        return {
            suggestedPreparer: suggestedPreparer
                ? { id: suggestedPreparer.id, name: suggestedPreparer.name, activeCloses: workload.get(suggestedPreparer.id) || 0 }
                : null,
            suggestedReviewer: suggestedReviewer
                ? { id: suggestedReviewer.id, name: suggestedReviewer.name, activeCloses: workload.get(suggestedReviewer.id) || 0 }
                : null,
        };
    }
}
