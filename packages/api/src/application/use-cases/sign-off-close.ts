import { ClosePeriodRepository, CloseTaskRepository } from '../../domain/ports';

export class SignOffCloseUseCase {
    constructor(
        private closePeriodRepo: ClosePeriodRepository,
        private taskRepo: CloseTaskRepository,
    ) { }

    async execute(clientId: string, data: { reviewNotes: string }): Promise<{ locked: boolean; signedOffAt: string }> {
        const closePeriod = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!closePeriod) throw new Error('No active close period');

        // Validate all tasks are complete
        const tasks = await this.taskRepo.findByClosePeriodId(closePeriod.id);
        const incompleteTasks = tasks.filter(t => t.status !== 'complete');

        if (incompleteTasks.length > 0) {
            throw new Error(`Cannot sign off: ${incompleteTasks.length} task(s) still incomplete`);
        }

        const signedOffAt = new Date();

        // Lock the close period
        await this.closePeriodRepo.updateSignoff(
            closePeriod.id,
            'Current User',
            data.reviewNotes,
        );

        return {
            locked: true,
            signedOffAt: signedOffAt.toISOString(),
        };
    }
}
