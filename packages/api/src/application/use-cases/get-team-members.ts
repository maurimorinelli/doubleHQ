import { TeamMemberRepository } from '../../domain/ports';
import { TeamMember } from '../../domain/entities';

/**
 * GetTeamMembersUseCase
 *
 * Retrieves all team members for a given firm.
 * Wraps the repository call to keep the presentation layer
 * from depending directly on infrastructure.
 */
export class GetTeamMembersUseCase {
    constructor(private teamMemberRepo: TeamMemberRepository) { }

    async execute(firmId: string): Promise<{ members: TeamMember[] }> {
        const members = await this.teamMemberRepo.findByFirmId(firmId);
        return { members };
    }
}
