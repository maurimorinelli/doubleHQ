import { ClosePeriodRepository, TeamMemberRepository, CloseTaskRepository } from '../../domain/ports/index';
import { ClosePeriodStatus } from '@doublehq/shared';

/**
 * Reassign preparer/reviewer on an open close period.
 * Cascades: tasks assigned to the old preparer get re-assigned to the new one.
 */
export class ReassignCloseUseCase {
    constructor(
        private closePeriodRepo: ClosePeriodRepository,
        private teamMemberRepo: TeamMemberRepository,
        private taskRepo: CloseTaskRepository,
    ) { }

    async execute(closePeriodId: string, preparerId: string, reviewerId: string) {
        // Validate the close period exists
        const cp = await this.closePeriodRepo.findById(closePeriodId);
        if (!cp) throw new Error(`Close period ${closePeriodId} not found`);
        if (cp.status === ClosePeriodStatus.CLOSED) {
            throw new Error('Cannot reassign a completed close period');
        }

        // Validate team members exist
        const [preparer, reviewer] = await Promise.all([
            this.teamMemberRepo.findById(preparerId),
            this.teamMemberRepo.findById(reviewerId),
        ]);
        if (!preparer) throw new Error(`Preparer ${preparerId} not found`);
        if (!reviewer) throw new Error(`Reviewer ${reviewerId} not found`);

        // Cascade: reassign tasks from old preparer → new preparer
        const oldPreparerId = cp.preparerId;
        let tasksReassigned = 0;
        if (oldPreparerId !== preparerId) {
            tasksReassigned = await this.taskRepo.reassignByClosePeriod(closePeriodId, oldPreparerId, preparerId);
        }

        // Update the close period header
        await this.closePeriodRepo.updateAssignment(closePeriodId, preparerId, reviewerId);

        return {
            closePeriodId,
            preparerId,
            preparerName: preparer.name,
            reviewerId,
            reviewerName: reviewer.name,
            tasksReassigned,
        };
    }
}
