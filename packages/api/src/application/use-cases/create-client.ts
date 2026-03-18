import { v4 as uuid } from 'uuid';
import {
    ClientRepository,
    ClosePeriodRepository,
    CloseTaskRepository,
    CloseTemplateRepository,
    ImportedTransactionRepository,
    ReconciliationRepository,
    TeamMemberRepository,
} from '../../domain/ports';
import { AiDataGenerator } from '../../domain/services/ai-data-generator.port';
import {
    CreateClientRequest, CreateClientResponse, createLogger,
    ClosePeriodStatus, HealthStatus, TaskStatus, TransactionStatus,
    TransactionType, BankAccountType, ReconciliationStatus,
    CloseSection, TaskTargetTab, AccountType,
} from '@doublehq/shared';

const logger = createLogger('CreateClient');

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
        return TaskTargetTab.TRANSACTIONS;   // pre-close tasks are mostly txn work
    return TaskTargetTab.OVERVIEW;
}

export class CreateClientUseCase {
    constructor(
        private clientRepo: ClientRepository,
        private closePeriodRepo: ClosePeriodRepository,
        private taskRepo: CloseTaskRepository,
        private templateRepo: CloseTemplateRepository,
        private txnRepo: ImportedTransactionRepository,
        private reconRepo: ReconciliationRepository,
        private teamMemberRepo: TeamMemberRepository,
        private aiDataGenerator: AiDataGenerator,
    ) { }

    async execute(firmId: string, request: CreateClientRequest): Promise<CreateClientResponse> {
        // 1. Pick a preparer and reviewer from the firm's team
        const teamMembers = await this.teamMemberRepo.findByFirmId(firmId);
        const preparers = teamMembers.filter(m => m.role === 'preparer' || m.role === 'admin');
        const reviewers = teamMembers.filter(m => m.role === 'reviewer' || m.role === 'manager');
        const preparer = preparers[Math.floor(Math.random() * preparers.length)] || teamMembers[0];
        const reviewer = reviewers[Math.floor(Math.random() * reviewers.length)] || teamMembers[0];

        // 2. Create the client
        const clientId = uuid();
        const client = await this.clientRepo.save({
            id: clientId,
            firmId,
            name: request.name,
            industry: request.industry,
            contactName: request.contactName,
            contactEmail: request.contactEmail,
            contactPhone: request.contactPhone,
            qboConnected: request.qboConnected,
            xeroConnected: false,
            monthlyRevenue: request.monthlyRevenue,
            preparerId: preparer.id,
            reviewerId: reviewer.id,
            accountType: request.accountType as AccountType,
            fiscalYearEnd: request.fiscalYearEnd,
            notes: request.notes || '',
        });

        // 3. If no close period requested, return client-only result
        if (!request.templateId || !request.closePeriod) {
            logger.info(`✅ Created client "${request.name}" (no close period)`);
            return {
                clientId,
                closePeriodId: null,
                totalTasks: 0,
                generatedTransactions: 0,
            };
        }

        // 4. Load template and create close period + tasks
        const template = await this.templateRepo.findById(request.templateId);
        if (!template) throw new Error(`Template ${request.templateId} not found`);

        const [year, month] = request.closePeriod.split('-').map(Number);
        const startDate = new Date();  // work starts today
        const dueDate = new Date(year, month, 10); // due 10th of next month

        const allTemplateTasks = (template.sections || []).flatMap(s => s.tasks || []);
        const totalTasks = allTemplateTasks.length;

        const closePeriodId = uuid();
        await this.closePeriodRepo.save({
            id: closePeriodId,
            clientId,
            period: request.closePeriod,
            status: ClosePeriodStatus.IN_PROGRESS,
            startDate,
            dueDate,
            completedDate: null,
            preparerId: preparer.id,
            reviewerId: reviewer.id,
            totalTasks,
            completedTasks: 0,
            blockedTasks: 0,
            healthScore: 100,
            healthStatus: HealthStatus.ON_TRACK,
            previousCloseTime: 0,
        });

        // 5. Copy template tasks → close tasks
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
                assigneeId: preparer.id,
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

        // 6. Generate AI transaction data
        logger.info(`🤖 Generating AI transactions for new client "${request.name}"...`);
        const aiData = await this.aiDataGenerator.generateClientData({
            clientName: request.name,
            industry: request.industry,
            monthlyRevenue: request.monthlyRevenue,
            accountType: request.accountType,
            period: request.closePeriod,
        });

        // 7. Persist generated transactions — all arrive RAW (uncategorized)
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

        // 8. Generate reconciliation records (Business Checking + Business Credit Card)
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

        logger.info(`✅ Created client "${request.name}" with ${transactions.length} AI-generated transactions and ${reconciliations.length} reconciliation accounts`);

        return {
            clientId,
            closePeriodId,
            totalTasks,
            generatedTransactions: transactions.length,
        };
    }
}
