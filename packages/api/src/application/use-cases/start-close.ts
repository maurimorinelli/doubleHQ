import { v4 as uuid } from 'uuid';
import {
    ClientRepository,
    ClosePeriodRepository,
    CloseTaskRepository,
    CloseTemplateRepository,
    ImportedTransactionRepository,
    ReconciliationRepository,
} from '../../domain/ports';
import { CloseTemplate } from '../../domain/entities/index';
import { AiDataGenerator } from '../../domain/services/ai-data-generator.port';
import {
    createLogger, ClosePeriodStatus, HealthStatus, TaskStatus,
    TransactionStatus, TransactionType, BankAccountType,
    ReconciliationStatus, CloseSection, TaskTargetTab,
} from '@doublehq/shared';

const logger = createLogger('StartClose');

// ─── Get Templates ───────────────────────────────────────────────────────────

export class GetTemplatesUseCase {
    constructor(private templateRepo: CloseTemplateRepository) { }

    async execute(firmId: string): Promise<{ templates: CloseTemplate[] }> {
        const templates = await this.templateRepo.findByFirmId(firmId);
        return { templates };
    }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Map a section name to the correct client-detail tab key */
function sectionToTab(sectionName: string): TaskTargetTab {
    const lower = sectionName.toLowerCase();
    if (lower.includes('reconcil')) return TaskTargetTab.RECONCILIATION;
    if (lower.includes('transaction')) return TaskTargetTab.TRANSACTIONS;
    if (lower.includes('adjust') || lower.includes('journal') || lower.includes('entry'))
        return TaskTargetTab.ADJUSTMENTS;
    if (lower.includes('review') || lower.includes('sign'))
        return TaskTargetTab.REVIEW;
    if (lower.includes('pre-close') || lower.includes('pre close'))
        return TaskTargetTab.TRANSACTIONS;
    return TaskTargetTab.OVERVIEW;
}

// ─── Start Close ─────────────────────────────────────────────────────────────

export interface StartCloseRequest {
    templateId: string;
    period: string; // e.g., "2026-02"
    preparerId?: string; // optional — falls back to client default
    reviewerId?: string; // optional — falls back to client default
}

export class StartCloseUseCase {
    constructor(
        private clientRepo: ClientRepository,
        private closePeriodRepo: ClosePeriodRepository,
        private taskRepo: CloseTaskRepository,
        private templateRepo: CloseTemplateRepository,
        private txnRepo: ImportedTransactionRepository,
        private reconRepo: ReconciliationRepository,
        private aiDataGenerator: AiDataGenerator,
    ) { }

    async execute(clientId: string, request: StartCloseRequest) {
        // 1. Validate client exists
        const client = await this.clientRepo.findById(clientId);
        if (!client) throw new Error(`Client ${clientId} not found`);

        // 2. Check no active close already exists for this period
        const existing = await this.closePeriodRepo.findByClientId(clientId, 10);
        const duplicate = existing.find(cp => cp.period === request.period && cp.status !== ClosePeriodStatus.CLOSED);
        if (duplicate) throw new Error(`Close period ${request.period} already exists for this client`);

        // 3. Load template with sections and tasks
        const template = await this.templateRepo.findById(request.templateId);
        if (!template) throw new Error(`Template ${request.templateId} not found`);

        // 4. Compute dates — startDate = today, dueDate = 10th of month after the period
        const [year, month] = request.period.split('-').map(Number);
        const startDate = new Date();
        const dueDate = new Date(year, month, 10); // due 10th of next month

        // 5. Count total tasks from template
        const allTemplateTasks = (template.sections || []).flatMap(s => s.tasks || []);
        const totalTasks = allTemplateTasks.length;

        // 6. Create close period
        const closePeriodId = uuid();
        await this.closePeriodRepo.save({
            id: closePeriodId,
            clientId,
            period: request.period,
            status: ClosePeriodStatus.IN_PROGRESS,
            startDate,
            dueDate,
            completedDate: null,
            preparerId: request.preparerId || client.preparerId,
            reviewerId: request.reviewerId || client.reviewerId,
            totalTasks,
            completedTasks: 0,
            blockedTasks: 0,
            healthScore: 100,
            healthStatus: HealthStatus.ON_TRACK,
            previousCloseTime: 0,
        });

        // 7. Copy template tasks → close tasks
        const closeTasks = (template.sections || []).flatMap((section, sIdx) =>
            (section.tasks || []).map(task => ({
                id: uuid(),
                closePeriodId,
                section: section.name as CloseSection,
                sectionOrder: section.order ?? sIdx + 1,
                title: task.title,
                description: task.description || '',
                status: TaskStatus.NOT_STARTED,
                autoCompleteRule: task.autoCompleteRule,
                assigneeId: request.preparerId || client.preparerId, // default to preparer
                dueDate,
                completedDate: null,
                blockedReason: null,
                order: task.order,
                estimatedMinutes: task.estimatedMinutes || 30,
                actualMinutes: null,
                targetTab: sectionToTab(section.name),
            }))
        );

        await this.taskRepo.saveBatch(closeTasks);

        // 8. Generate AI transaction data
        logger.info(`🤖 Generating AI transactions for "${client.name}" (${request.period})...`);
        const aiData = await this.aiDataGenerator.generateClientData({
            clientName: client.name,
            industry: client.industry,
            monthlyRevenue: client.monthlyRevenue,
            accountType: client.accountType,
            period: request.period,
        });

        // 9. Persist generated transactions — all arrive RAW (uncategorized)
        const transactions = aiData.transactions.map(t => ({
            id: uuid(),
            closePeriodId,
            clientId,
            date: new Date(t.date),
            description: t.description,
            vendor: t.vendor,
            amount: t.amount,
            type: t.type as TransactionType,
            bankAccount: t.bankAccount as BankAccountType,
            importedCategory: null,
            finalCategory: null,
            status: TransactionStatus.UNCATEGORIZED,
            aiSuggestedCategory: null,
            aiConfidence: null,
            reviewedBy: null,
            reviewedAt: null,
            isManual: false,
        }));
        if (transactions.length > 0) {
            await this.txnRepo.saveBatch(transactions);
        }

        // 10. Generate reconciliation records (Business Checking + Business Credit Card)
        const checkingTxns = transactions.filter(t => t.bankAccount === 'checking');
        const ccTxns = transactions.filter(t => t.bankAccount === 'credit_card');
        const checkingBalance = checkingTxns.reduce((sum, t) =>
            sum + (t.type === 'debit' ? -t.amount : t.amount), 15000 + Math.random() * 30000
        );
        const ccBalance = ccTxns.reduce((sum, t) =>
            sum + (t.type === 'debit' ? t.amount : -t.amount), 1000 + Math.random() * 5000
        );

        const reconciliations = [
            {
                id: uuid(),
                closePeriodId,
                accountName: 'Business Checking',
                accountNumber: String(1000 + Math.floor(Math.random() * 9000)),
                bookBalance: Math.round(checkingBalance * 100) / 100,
                bankBalance: null as number | null,
                difference: Math.round(checkingBalance * 100) / 100,
                status: ReconciliationStatus.NOT_STARTED,
                reconciledBy: null as string | null,
                reconciledAt: null as Date | null,
                notes: null as string | null,
            },
            {
                id: uuid(),
                closePeriodId,
                accountName: 'Business Credit Card',
                accountNumber: String(4000 + Math.floor(Math.random() * 9000)),
                bookBalance: Math.round(ccBalance * 100) / 100,
                bankBalance: null as number | null,
                difference: Math.round(ccBalance * 100) / 100,
                status: ReconciliationStatus.NOT_STARTED,
                reconciledBy: null as string | null,
                reconciledAt: null as Date | null,
                notes: null as string | null,
            },
        ];
        await this.reconRepo.saveBatch(reconciliations);

        logger.info(`✅ Close started for "${client.name}" with ${transactions.length} AI-generated transactions`);

        // 11. Return the created close period ID for redirect
        return {
            closePeriodId,
            period: request.period,
            totalTasks,
            generatedTransactions: transactions.length,
            status: 'in_progress',
        };
    }
}
