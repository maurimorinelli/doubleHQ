import { CLOSE_SECTION_LABELS, CLOSE_SECTION_ORDER, HealthStatus, TaskTargetTab } from '@doublehq/shared';
import type { ClientCloseDetailResponse, WorkflowSectionData, TaskItem, CommunicationEntry, RiskFactor } from '@doublehq/shared';
import { ClientRepository, ClosePeriodRepository, CloseTaskRepository, ClientQuestionRepository, TransactionFlagRepository } from '../../domain/ports';
import type { ClientQuestion } from '../../domain/entities';
import { ClientNotFoundError } from '../../domain/errors';
import { computeHealthStatusOverride, computeRiskAssessment } from '../../domain/services/close-status.service';

export class GetClientCloseDetailUseCase {
    constructor(
        private clientRepo: ClientRepository,
        private closePeriodRepo: ClosePeriodRepository,
        private taskRepo: CloseTaskRepository,
        private questionRepo: ClientQuestionRepository,
        private flagRepo: TransactionFlagRepository,
    ) { }

    async execute(clientId: string): Promise<ClientCloseDetailResponse> {
        const client = await this.clientRepo.findById(clientId);
        if (!client) throw new ClientNotFoundError(clientId);

        const closePeriod = await this.closePeriodRepo.findLatestByClientId(clientId);
        if (!closePeriod) {
            return {
                client: {
                    id: client.id,
                    name: client.name,
                    industry: client.industry,
                    contactName: client.contactName,
                    contactEmail: client.contactEmail,
                    qboConnected: client.qboConnected,
                },
                closePeriod: null,
                sections: [],
                riskAssessment: null,
                communications: [],
            };
        }

        const [tasks, questions, flags] = await Promise.all([
            this.taskRepo.findByClosePeriodId(closePeriod.id),
            this.questionRepo.findByClosePeriodId(closePeriod.id),
            this.flagRepo.findByClosePeriodId(closePeriod.id),
        ]);

        // Group tasks by section
        const sectionTabMap: Record<string, TaskTargetTab> = {
            'Pre-Close': TaskTargetTab.TRANSACTIONS,
            'Account Reconciliations': TaskTargetTab.RECONCILIATION,
            'Transaction Review': TaskTargetTab.TRANSACTIONS,
            'Adjusting Entries': TaskTargetTab.ADJUSTMENTS,
            'Review & Sign-off': TaskTargetTab.REVIEW,
        };

        const sections: WorkflowSectionData[] = CLOSE_SECTION_ORDER.map(sectionKey => {
            const sectionTasks = tasks.filter(t => t.section === sectionKey);
            const completedCount = sectionTasks.filter(t => t.status === 'complete').length;
            const blockedTasks = sectionTasks.filter(t => t.status === 'blocked');
            const isBlocked = blockedTasks.length > 0;
            const sectionDefaultTab = sectionTabMap[sectionKey] || TaskTargetTab.OVERVIEW;

            return {
                name: sectionKey,
                label: CLOSE_SECTION_LABELS[sectionKey],
                totalTasks: sectionTasks.length,
                completedTasks: completedCount,
                isBlocked,
                blockedReason: isBlocked ? blockedTasks[0]?.blockedReason || 'Tasks are blocked' : undefined,
                tasks: sectionTasks.map((t): TaskItem => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    autoCompleteRule: t.autoCompleteRule || null,
                    sectionOrder: t.sectionOrder || 1,
                    assignee: t.assignee?.name || 'Unassigned',
                    blockedReason: t.blockedReason,
                    targetTab: (t.targetTab && t.targetTab !== 'overview')
                        ? t.targetTab
                        : sectionDefaultTab,
                })),
            };
        });

        // Build risk assessment
        const pendingQuestions = questions.filter(q => q.status === 'pending');
        const unresolvedFlags = flags.filter(f => !f.isResolved);
        const daysRemaining = Math.floor(
            (new Date(closePeriod.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        const isComplete = tasks.length > 0 && tasks.every(t => t.status === 'complete');

        const oldestQuestionDays = pendingQuestions.length > 0
            ? Math.floor((Date.now() - new Date(pendingQuestions[pendingQuestions.length - 1].sentAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
        const unconfirmedAmount = pendingQuestions.reduce((sum, q) => sum + Number(q.transactionAmount || 0), 0);

        const riskAssessment = computeRiskAssessment({
            totalTasks: closePeriod.totalTasks,
            completedTasks: closePeriod.completedTasks,
            blockedTasks: closePeriod.blockedTasks,
            closePeriodStatus: closePeriod.status,
            daysRemaining,
            pendingQuestionsCount: pendingQuestions.length,
            oldestQuestionDays,
            unconfirmedAmount,
            unresolvedFlagsCount: unresolvedFlags.length,
        });

        // Build communication timeline
        const communications = this.buildCommunications(questions);

        // Real-time health status override (logic in close-status.service.ts)
        const healthStatus = computeHealthStatusOverride({
            storedHealthStatus: closePeriod.healthStatus,
            closePeriodStatus: closePeriod.status,
            daysRemaining,
            totalTasks: closePeriod.totalTasks,
            completedTasks: closePeriod.completedTasks,
        });

        return {
            client: {
                id: client.id,
                name: client.name,
                industry: client.industry,
                contactName: client.contactName,
                contactEmail: client.contactEmail,
                qboConnected: client.qboConnected,
            },
            closePeriod: {
                id: closePeriod.id,
                period: closePeriod.period,
                status: closePeriod.status,
                healthScore: closePeriod.healthScore,
                healthStatus,
                dueDate: closePeriod.dueDate.toString(),
                daysRemaining,
                progress: tasks.length > 0
                    ? Math.round((tasks.filter(t => t.status === 'complete').length / tasks.length) * 1000) / 10
                    : 0,
                preparerId: closePeriod.preparerId,
                reviewerId: closePeriod.reviewerId,
                preparerName: closePeriod.preparer?.name || 'Unassigned',
                reviewerName: closePeriod.reviewer?.name || 'Unassigned',
            },
            sections,
            riskAssessment,
            communications,
        };
    }

    // computeRiskAssessment and getRecommendation extracted to close-status.service.ts

    private buildCommunications(questions: ClientQuestion[]): CommunicationEntry[] {
        const entries: CommunicationEntry[] = [];

        // Group by date
        const questionsByDate = new Map<string, ClientQuestion[]>();
        for (const q of questions) {
            const date = new Date(q.sentAt).toISOString().split('T')[0];
            if (!questionsByDate.has(date)) questionsByDate.set(date, []);
            questionsByDate.get(date)!.push(q);
        }

        for (const [date, qs] of questionsByDate) {
            entries.push({
                date,
                type: 'questions_sent',
                text: `${qs.length} transaction question${qs.length > 1 ? 's' : ''} sent to client`,
            });
        }

        // Add reminders
        for (const q of questions) {
            if (q.remindersSent > 0 && q.lastReminderAt) {
                entries.push({
                    date: new Date(q.lastReminderAt).toISOString().split('T')[0],
                    type: 'reminder',
                    text: `Reminder #${q.remindersSent} sent`,
                });
            }
            if (q.respondedAt) {
                entries.push({
                    date: new Date(q.respondedAt).toISOString().split('T')[0],
                    type: 'client_response',
                    text: `Client responded to question about ${q.transactionVendor}`,
                });
            }
        }

        // Sort by date descending
        entries.sort((a, b) => b.date.localeCompare(a.date));

        // Deduplicate
        const seen = new Set<string>();
        return entries.filter(e => {
            const key = `${e.date}-${e.type}-${e.text}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
}
