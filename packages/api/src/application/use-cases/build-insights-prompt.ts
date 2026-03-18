import {
    ClientRepository,
    ClosePeriodRepository,
    CloseTaskRepository,
    ClientQuestionRepository,
    TransactionFlagRepository,
    TeamMemberRepository,
} from '../../domain/ports';

/**
 * Builds a structured prompt for the AI insight generator.
 *
 * Design principle: AI receives PRE-COMPUTED FACTS, never raw data.
 * All metrics are calculated here — the AI only narrates and prioritizes.
 */

interface ClientSnapshot {
    clientId: string;
    clientName: string;
    industry: string;
    preparerName: string;
    preparerId: string;
    reviewerName: string;
    reviewerId: string;
    period: string;
    status: string;
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    completionPercent: number;
    daysRemaining: number;
    isOverdue: boolean;
    dueDate: string;
    pendingQuestions: number;
    oldestPendingQuestionDays: number | null;
    unresolvedFlags: number;
    healthScore: number;
    healthStatus: string;
}

interface TeamSnapshot {
    memberId: string;
    memberName: string;
    role: string;
    totalClients: number;
    onTrack: number;
    atRisk: number;
    behind: number;
    completedCloses: number;
}

export function createPromptBuilder(deps: {
    clientRepo: ClientRepository;
    closePeriodRepo: ClosePeriodRepository;
    taskRepo: CloseTaskRepository;
    questionRepo: ClientQuestionRepository;
    flagRepo: TransactionFlagRepository;
    teamMemberRepo: TeamMemberRepository;
}) {
    return async function buildInsightsPrompt(firmId: string): Promise<string> {
        const now = new Date();

        // 1. Fetch all data in parallel
        const [clients, closePeriods, teamMembers] = await Promise.all([
            deps.clientRepo.findAllByFirmId(firmId),
            deps.closePeriodRepo.findActiveByFirmId(firmId),
            deps.teamMemberRepo.findByFirmId(firmId),
        ]);

        if (closePeriods.length === 0) {
            return JSON.stringify({
                firmSnapshot: {
                    date: now.toISOString().split('T')[0],
                    totalActiveCloses: 0,
                    clients: [],
                    team: [],
                    message: 'No active close periods found.',
                },
            });
        }

        // 2. Build per-client snapshots with pre-computed metrics
        const clientSnapshots: ClientSnapshot[] = [];

        for (const cp of closePeriods) {
            const client = clients.find(c => c.id === cp.clientId);
            if (!client) continue;

            const preparer = teamMembers.find(m => m.id === cp.preparerId);
            const reviewer = teamMembers.find(m => m.id === cp.reviewerId);

            // Fetch questions and flags for this close period
            const [questions, flags] = await Promise.all([
                deps.questionRepo.findByClosePeriodId(cp.id),
                deps.flagRepo.findByClosePeriodId(cp.id),
            ]);

            const pendingQuestions = questions.filter(q => q.status === 'pending');
            const unresolvedFlags = flags.filter(f => !f.isResolved);

            // Pre-compute days remaining (negative = overdue)
            const dueDate = new Date(cp.dueDate);
            const diffMs = dueDate.getTime() - now.getTime();
            const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            // Oldest pending question age
            let oldestPendingDays: number | null = null;
            if (pendingQuestions.length > 0) {
                const ages = pendingQuestions.map(q => {
                    const sent = new Date(q.sentAt);
                    return Math.floor((now.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24));
                });
                oldestPendingDays = Math.max(...ages);
            }

            const completionPercent = cp.totalTasks > 0
                ? Math.round((cp.completedTasks / cp.totalTasks) * 100)
                : 0;

            clientSnapshots.push({
                clientId: client.id,
                clientName: client.name,
                industry: client.industry,
                preparerName: preparer?.name || 'Unassigned',
                preparerId: cp.preparerId,
                reviewerName: reviewer?.name || 'Unassigned',
                reviewerId: cp.reviewerId,
                period: cp.period,
                status: cp.status,
                totalTasks: cp.totalTasks,
                completedTasks: cp.completedTasks,
                blockedTasks: cp.blockedTasks,
                completionPercent,
                daysRemaining,
                isOverdue: daysRemaining < 0,
                dueDate: dueDate.toISOString().split('T')[0],
                pendingQuestions: pendingQuestions.length,
                oldestPendingQuestionDays: oldestPendingDays,
                unresolvedFlags: unresolvedFlags.length,
                healthScore: cp.healthScore,
                healthStatus: cp.healthStatus,
            });
        }

        // 3. Build per-team-member snapshots
        const teamSnapshots: TeamSnapshot[] = teamMembers
            .filter(m => m.isActive)
            .map(member => {
                const memberCloses = clientSnapshots.filter(
                    cs => cs.preparerId === member.id
                );
                return {
                    memberId: member.id,
                    memberName: member.name,
                    role: member.role,
                    totalClients: memberCloses.length,
                    onTrack: memberCloses.filter(c => c.healthStatus === 'on_track').length,
                    atRisk: memberCloses.filter(c => c.healthStatus === 'at_risk').length,
                    behind: memberCloses.filter(c => c.healthStatus === 'behind').length,
                    completedCloses: memberCloses.filter(c => c.status === 'done').length,
                };
            });

        // 4. Compute summary stats
        const summary = {
            totalActiveCloses: clientSnapshots.length,
            onTrack: clientSnapshots.filter(c => c.healthStatus === 'on_track').length,
            atRisk: clientSnapshots.filter(c => c.healthStatus === 'at_risk').length,
            behind: clientSnapshots.filter(c => c.healthStatus === 'behind').length,
            notStarted: clientSnapshots.filter(c => c.healthStatus === 'not_started').length,
            completed: clientSnapshots.filter(c => c.status === 'done').length,
            overdue: clientSnapshots.filter(c => c.isOverdue && c.status !== 'done').length,
            totalPendingQuestions: clientSnapshots.reduce((sum, c) => sum + c.pendingQuestions, 0),
            totalUnresolvedFlags: clientSnapshots.reduce((sum, c) => sum + c.unresolvedFlags, 0),
        };

        // 5. Build the final prompt payload
        const firmSnapshot = {
            date: now.toISOString().split('T')[0],
            summary,
            clients: clientSnapshots,
            team: teamSnapshots,
        };

        return `Here is the current state of the firm's month-end closes as of ${now.toISOString().split('T')[0]}:

${JSON.stringify(firmSnapshot, null, 2)}

Based on this data, generate 4-8 actionable insights. Prioritize urgent items first. Include at least one insight about team workload distribution if there is an imbalance.`;
    };
}
