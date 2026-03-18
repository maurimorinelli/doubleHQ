import { ClientQuestionRepository } from '../../domain/ports';
import { ClientQuestion } from '../../domain/entities';

/**
 * GetClientQuestionsUseCase
 *
 * Retrieves all questions for a given client.
 * Wraps the repository call to keep the presentation layer
 * from depending directly on infrastructure.
 */
export class GetClientQuestionsUseCase {
    constructor(private questionRepo: ClientQuestionRepository) { }

    async execute(clientId: string): Promise<{ questions: ClientQuestion[] }> {
        const questions = await this.questionRepo.findByClientId(clientId);
        return { questions };
    }
}
