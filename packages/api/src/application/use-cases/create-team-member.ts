import { TeamMemberRepository } from '../../domain/ports';
import { TeamMember } from '../../domain/entities';
import { TeamRole } from '@doublehq/shared';
import { v4 as uuid } from 'uuid';

/**
 * CreateTeamMemberUseCase
 *
 * Creates a new team member within a firm.
 * Encapsulates UUID generation and entity construction
 * that previously leaked into the route handler.
 */
export class CreateTeamMemberUseCase {
    constructor(private teamMemberRepo: TeamMemberRepository) { }

    async execute(
        firmId: string,
        data: { name: string; email: string; role: string },
    ): Promise<TeamMember> {
        return this.teamMemberRepo.save({
            id: uuid(),
            firmId,
            name: data.name,
            email: data.email,
            role: data.role as TeamRole,
            avatarUrl: '',
        });
    }
}
