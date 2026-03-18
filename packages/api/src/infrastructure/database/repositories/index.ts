import { HealthStatus, ClosePeriodStatus, TaskStatus, QuestionStatus, TransactionStatus, BankAccountType, JournalEntryStatus } from '@doublehq/shared';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { ClosePeriodEntity } from '../entities/close-period.entity';
import { CloseTaskEntity } from '../entities/close-task.entity';
import { ClientQuestionEntity } from '../entities/client-question.entity';
import { TransactionFlagEntity } from '../entities/transaction-flag.entity';
import { ClientEntity } from '../entities/client.entity';
import { TeamMemberEntity } from '../entities/team-member.entity';
import { CachedInsightEntity } from '../entities/cached-insight.entity';
import { ImportedTransactionEntity } from '../entities/imported-transaction.entity';
import { ReconciliationEntity } from '../entities/reconciliation.entity';
import { JournalEntryEntity } from '../entities/journal-entry.entity';
import { CloseTemplateEntity } from '../entities/close-template.entity';
import { FirmEntity } from '../entities/firm.entity';
import {
    ClientRepository,
    ClosePeriodRepository,
    CloseTaskRepository,
    ClientQuestionRepository,
    TransactionFlagRepository,
    TeamMemberRepository,
    CachedInsightRepository,
    ImportedTransactionRepository,
    ReconciliationRepository,
    JournalEntryRepository,
    CloseTemplateRepository,
    AuthRepository,
    FirmRepository,
    TeamMemberWithAuth,
} from '../../../domain/ports';
import {
    Client,
    Firm,
    ClosePeriod,
    CloseTask,
    ClientQuestion,
    TransactionFlag,
    TeamMember,
    CachedInsight,
    ImportedTransaction,
    Reconciliation,
    JournalEntry,
    CloseTemplate,
} from '../../../domain/entities';

// ─── Client Repository ───────────────────────────────────────────────────────

export class TypeOrmClientRepository implements ClientRepository {
    private repo: Repository<ClientEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(ClientEntity);
    }

    async findAllByFirmId(firmId: string): Promise<Client[]> {
        return this.repo.find({
            where: { firmId },
            relations: ['preparer', 'reviewer'],
            order: { name: 'ASC' },
        });
    }

    async findById(id: string): Promise<Client | null> {
        return this.repo.findOne({
            where: { id },
            relations: ['preparer', 'reviewer'],
        });
    }

    async save(client: Omit<Client, 'createdAt'>): Promise<Client> {
        const entity = this.repo.create(client as DeepPartial<ClientEntity>);
        return this.repo.save(entity);
    }
}

// ─── ClosePeriod Repository ──────────────────────────────────────────────────

export class TypeOrmClosePeriodRepository implements ClosePeriodRepository {
    private repo: Repository<ClosePeriodEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(ClosePeriodEntity);
    }

    async findActiveByFirmId(firmId: string, period?: string): Promise<ClosePeriod[]> {
        const qb = this.repo
            .createQueryBuilder('cp')
            .innerJoinAndSelect('cp.client', 'client')
            .innerJoinAndSelect('cp.preparer', 'preparer')
            .innerJoinAndSelect('cp.reviewer', 'reviewer')
            .where('client.firmId = :firmId', { firmId });

        if (period) {
            qb.andWhere('cp.period = :period', { period });
        }

        return qb.orderBy('cp.healthScore', 'ASC').getMany();
    }

    async findByClientId(clientId: string, limit: number = 4): Promise<ClosePeriod[]> {
        return this.repo.find({
            where: { clientId },
            order: { period: 'DESC' },
            take: limit,
        });
    }

    async findLatestByClientId(clientId: string): Promise<ClosePeriod | null> {
        return this.repo.findOne({
            where: { clientId },
            order: { period: 'DESC' },
            relations: ['preparer', 'reviewer'],
        });
    }

    async updateHealthScore(id: string, score: number, status: HealthStatus): Promise<void> {
        await this.repo.update(id, { healthScore: score, healthStatus: status as HealthStatus });
    }

    async save(period: Omit<ClosePeriod, 'createdAt'>): Promise<ClosePeriod> {
        const entity = this.repo.create(period as DeepPartial<ClosePeriodEntity>);
        return this.repo.save(entity);
    }

    async updateTaskCounts(id: string, completed: number, total: number): Promise<void> {
        await this.repo.update(id, { completedTasks: completed, totalTasks: total });
    }

    async updateSignoff(id: string, signedOffBy: string, reviewNotes: string): Promise<void> {
        await this.repo.update(id, {
            status: ClosePeriodStatus.CLOSED,
            completedDate: new Date(),
            signedOffBy,
            reviewNotes,
        });
    }

    async findById(id: string): Promise<ClosePeriod | null> {
        return this.repo.findOne({
            where: { id },
            relations: ['client', 'preparer', 'reviewer'],
        });
    }

    async updateAssignment(id: string, preparerId: string, reviewerId: string): Promise<void> {
        await this.repo.update(id, { preparerId, reviewerId });
    }
}

// ─── CloseTask Repository ────────────────────────────────────────────────────

export class TypeOrmCloseTaskRepository implements CloseTaskRepository {
    private repo: Repository<CloseTaskEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(CloseTaskEntity);
    }

    async findByClosePeriodId(closePeriodId: string): Promise<CloseTask[]> {
        return this.repo.find({
            where: { closePeriodId },
            relations: ['assignee'],
            order: { sectionOrder: 'ASC', order: 'ASC' },
        });
    }

    async findById(id: string): Promise<CloseTask | null> {
        return this.repo.findOne({ where: { id } });
    }

    async updateStatus(id: string, status: TaskStatus | string, completedDate: Date | null): Promise<void> {
        await this.repo.update(id, { status: status as TaskStatus, completedDate });
    }

    async saveBatch(tasks: CloseTask[]): Promise<void> {
        const entities = tasks.map(t => this.repo.create(t as DeepPartial<CloseTaskEntity>));
        await this.repo.save(entities);
    }

    async reassignByClosePeriod(closePeriodId: string, oldAssigneeId: string, newAssigneeId: string): Promise<number> {
        const result = await this.repo.update(
            { closePeriodId, assigneeId: oldAssigneeId },
            { assigneeId: newAssigneeId },
        );
        return result.affected || 0;
    }
}

// ─── ClientQuestion Repository ───────────────────────────────────────────────

export class TypeOrmClientQuestionRepository implements ClientQuestionRepository {
    private repo: Repository<ClientQuestionEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(ClientQuestionEntity);
    }

    async findByClosePeriodId(closePeriodId: string): Promise<ClientQuestion[]> {
        return this.repo.find({
            where: { closePeriodId },
            order: { sentAt: 'DESC' },
        });
    }

    async findByClientId(clientId: string): Promise<ClientQuestion[]> {
        return this.repo.find({
            where: { clientId },
            order: { sentAt: 'DESC' },
        });
    }

    async findPendingByFirmId(firmId: string, period: string): Promise<ClientQuestion[]> {
        return this.repo
            .createQueryBuilder('cq')
            .innerJoin('cq.closePeriod', 'cp')
            .innerJoin('cp.client', 'client')
            .where('client.firmId = :firmId', { firmId })
            .andWhere('cp.period = :period', { period })
            .andWhere('cq.status = :status', { status: 'pending' })
            .orderBy('cq.sentAt', 'ASC')
            .getMany();
    }

    async save(question: Omit<ClientQuestion, 'respondedAt' | 'response' | 'remindersSent' | 'lastReminderAt'>): Promise<ClientQuestion> {
        const entity = this.repo.create({
            ...question,
            respondedAt: null,
            response: null,
            remindersSent: 0,
            lastReminderAt: null,
        } as DeepPartial<ClientQuestionEntity>);
        return this.repo.save(entity);
    }

    async resolve(id: string, response: string): Promise<void> {
        await this.repo.update(id, {
            response,
            respondedAt: new Date(),
            status: QuestionStatus.ANSWERED,
        });
    }
}

// ─── TransactionFlag Repository ──────────────────────────────────────────────

export class TypeOrmTransactionFlagRepository implements TransactionFlagRepository {
    private repo: Repository<TransactionFlagEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(TransactionFlagEntity);
    }

    async findByClosePeriodId(closePeriodId: string): Promise<TransactionFlag[]> {
        return this.repo.find({
            where: { closePeriodId },
            order: { flaggedAt: 'DESC' },
        });
    }

    async findUnresolvedByClientId(clientId: string, closePeriodId: string): Promise<TransactionFlag[]> {
        return this.repo.find({
            where: { clientId, closePeriodId, isResolved: false },
            order: { flaggedAt: 'DESC' },
        });
    }

    async saveBatch(flags: TransactionFlag[]): Promise<void> {
        const entities = flags.map(f => this.repo.create(f as DeepPartial<TransactionFlagEntity>));
        await this.repo.save(entities);
    }

    async deleteByClosePeriodId(closePeriodId: string): Promise<void> {
        await this.repo.delete({ closePeriodId });
    }

    async resolveByVendorAndAmount(clientId: string, vendor: string, amount: number): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update(TransactionFlagEntity)
            .set({ isResolved: true, resolvedAt: new Date(), resolvedBy: 'System' })
            .where('"clientId" = :clientId', { clientId })
            .andWhere('vendor = :vendor', { vendor })
            .andWhere('ABS(amount - :amount) < 0.01', { amount })
            .andWhere('"isResolved" = false')
            .execute();
        return result.affected || 0;
    }

    async resolveByTransactionId(clientId: string, transactionId: string): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update(TransactionFlagEntity)
            .set({ isResolved: true, resolvedAt: new Date(), resolvedBy: 'System' })
            .where('"clientId" = :clientId', { clientId })
            .andWhere('"transactionId" = :transactionId', { transactionId })
            .andWhere('"isResolved" = false')
            .execute();
        return result.affected || 0;
    }
}

// ─── TeamMember Repository ───────────────────────────────────────────────────

export class TypeOrmTeamMemberRepository implements TeamMemberRepository {
    private repo: Repository<TeamMemberEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(TeamMemberEntity);
    }

    async findByFirmId(firmId: string): Promise<TeamMember[]> {
        return this.repo.find({
            where: { firmId, isActive: true },
            order: { name: 'ASC' },
        });
    }

    async findById(id: string): Promise<TeamMember | null> {
        return this.repo.findOne({ where: { id } });
    }

    async save(member: Omit<TeamMember, 'isActive'>): Promise<TeamMember> {
        const entity = this.repo.create({ ...member, isActive: true } as DeepPartial<TeamMemberEntity>);
        return this.repo.save(entity);
    }
}

// ─── CachedInsight Repository ────────────────────────────────────────────────

export class TypeOrmCachedInsightRepository implements CachedInsightRepository {
    private repo: Repository<CachedInsightEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(CachedInsightEntity);
    }

    async findLatestByFirmId(firmId: string): Promise<CachedInsight | null> {
        return this.repo.findOne({
            where: { firmId },
            order: { generatedAt: 'DESC' },
        });
    }

    async save(insight: Omit<CachedInsight, 'id'>): Promise<CachedInsight> {
        const { v4: uuid } = await import('uuid');
        const entity = this.repo.create({ ...insight, id: uuid() });
        return this.repo.save(entity);
    }
}

// ─── ImportedTransaction Repository ──────────────────────────────────────────

export class TypeOrmImportedTransactionRepository implements ImportedTransactionRepository {
    private repo: Repository<ImportedTransactionEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(ImportedTransactionEntity);
    }

    async findByClosePeriodId(closePeriodId: string): Promise<ImportedTransaction[]> {
        return this.repo.find({
            where: { closePeriodId },
            order: { date: 'DESC' },
        });
    }

    async findById(id: string): Promise<ImportedTransaction | null> {
        return this.repo.findOne({ where: { id } });
    }

    async updateCategory(id: string, category: string, status: TransactionStatus | string): Promise<void> {
        await this.repo.update(id, { finalCategory: category, status: status as TransactionStatus, reviewedAt: new Date() });
    }

    async countByClosePeriodAndStatus(closePeriodId: string, bankAccount: string): Promise<{ total: number; categorized: number }> {
        const total = await this.repo.count({ where: { closePeriodId, bankAccount: bankAccount as BankAccountType } });
        const categorized = await this.repo.count({ where: { closePeriodId, bankAccount: bankAccount as BankAccountType, status: TransactionStatus.CATEGORIZED } });
        return { total, categorized };
    }

    async updateAllWithAiSuggestions(closePeriodId: string): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update(ImportedTransactionEntity)
            .set({ finalCategory: () => '"aiSuggestedCategory"', status: TransactionStatus.CATEGORIZED, reviewedAt: new Date() })
            .where('"closePeriodId" = :closePeriodId', { closePeriodId })
            .andWhere('status = :status', { status: TransactionStatus.UNCATEGORIZED })
            .andWhere('"aiSuggestedCategory" IS NOT NULL')
            .execute();
        return result.affected || 0;
    }

    async saveBatch(txns: ImportedTransaction[]): Promise<void> {
        const entities = txns.map(t => this.repo.create(t as DeepPartial<ImportedTransactionEntity>));
        await this.repo.save(entities);
    }

    async updateBulkAiSuggestions(updates: Array<{ id: string; aiSuggestedCategory: string; aiConfidence: number }>): Promise<number> {
        let count = 0;
        for (const u of updates) {
            await this.repo.update(u.id, {
                aiSuggestedCategory: u.aiSuggestedCategory,
                aiConfidence: u.aiConfidence,
            });
            count++;
        }
        return count;
    }

    async updateAmount(id: string, amount: number): Promise<void> {
        await this.repo.update(id, { amount });
    }

    async deleteById(id: string): Promise<void> {
        await this.repo.delete(id);
    }

    async saveOne(txn: ImportedTransaction): Promise<ImportedTransaction> {
        const entity = this.repo.create(txn as DeepPartial<ImportedTransactionEntity>);
        return this.repo.save(entity);
    }

    async sumByClosePeriodAndAccount(closePeriodId: string): Promise<Array<{ bankAccount: string; total: number }>> {
        const results = await this.repo
            .createQueryBuilder('t')
            .select('t.bankAccount', 'bankAccount')
            .addSelect('SUM(CASE WHEN t.type = \'credit\' THEN t.amount ELSE -t.amount END)', 'total')
            .where('t."closePeriodId" = :closePeriodId', { closePeriodId })
            .groupBy('t.bankAccount')
            .getRawMany();
        return results.map(r => ({ bankAccount: r.bankAccount, total: Number(r.total) || 0 }));
    }
}

// ─── Reconciliation Repository ───────────────────────────────────────────────

export class TypeOrmReconciliationRepository implements ReconciliationRepository {
    private repo: Repository<ReconciliationEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(ReconciliationEntity);
    }

    async findByClosePeriodId(closePeriodId: string): Promise<Reconciliation[]> {
        return this.repo.find({
            where: { closePeriodId },
            order: { accountName: 'ASC' },
        });
    }

    async findById(id: string): Promise<Reconciliation | null> {
        return this.repo.findOne({ where: { id } });
    }

    async update(id: string, data: Partial<Reconciliation>): Promise<void> {
        await this.repo.update(id, data as DeepPartial<ReconciliationEntity>);
    }

    async saveBatch(recs: Reconciliation[]): Promise<void> {
        const entities = recs.map(r => this.repo.create(r as DeepPartial<ReconciliationEntity>));
        await this.repo.save(entities);
    }
}

// ─── JournalEntry Repository ─────────────────────────────────────────────────

export class TypeOrmJournalEntryRepository implements JournalEntryRepository {
    private repo: Repository<JournalEntryEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(JournalEntryEntity);
    }

    async findByClosePeriodId(closePeriodId: string): Promise<JournalEntry[]> {
        return this.repo.find({
            where: { closePeriodId },
            relations: ['lines', 'creator'],
            order: { date: 'DESC' },
        });
    }

    async findById(id: string): Promise<JournalEntry | null> {
        return this.repo.findOne({ where: { id }, relations: ['lines'] });
    }

    async save(entry: Partial<JournalEntry>): Promise<JournalEntry> {
        const entity = this.repo.create(entry as DeepPartial<JournalEntryEntity>);
        return this.repo.save(entity);
    }

    async updateStatus(id: string, status: JournalEntryStatus | string, postedAt: Date | null): Promise<void> {
        await this.repo.update(id, { status: status as JournalEntryStatus, postedAt });
    }
}

// ─── CloseTemplate Repository ────────────────────────────────────────────────

export class TypeOrmCloseTemplateRepository implements CloseTemplateRepository {
    private repo: Repository<CloseTemplateEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(CloseTemplateEntity);
    }

    async findByFirmId(firmId: string): Promise<CloseTemplate[]> {
        return this.repo.find({
            where: { firmId },
            relations: ['sections', 'sections.tasks'],
            order: { name: 'ASC' },
        });
    }

    async findById(id: string): Promise<CloseTemplate | null> {
        return this.repo.findOne({
            where: { id },
            relations: ['sections', 'sections.tasks'],
        });
    }
}

// ─── Auth Repository ─────────────────────────────────────────────────────────

export class TypeOrmAuthRepository implements AuthRepository {
    private repo: Repository<TeamMemberEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(TeamMemberEntity);
    }

    async findByEmail(email: string): Promise<TeamMemberWithAuth | null> {
        const user = await this.repo.findOne({
            where: { email },
            relations: ['firm'],
        });
        if (!user) return null;
        return { ...user, firmName: user.firm?.name || null };
    }

    async findByIdWithFirm(id: string): Promise<TeamMemberWithAuth | null> {
        const user = await this.repo.findOne({
            where: { id },
            relations: ['firm'],
        });
        if (!user) return null;
        return { ...user, firmName: user.firm?.name || null };
    }

    async createWithPassword(
        member: Omit<TeamMemberWithAuth, 'passwordHash' | 'firmName'>,
        passwordHash: string,
    ): Promise<TeamMemberWithAuth> {
        const entity = this.repo.create({
            ...member,
            passwordHash,
        } as DeepPartial<TeamMemberEntity>);
        const saved = await this.repo.save(entity);
        return { ...saved, firmName: null };
    }
}

// ─── Firm Repository ─────────────────────────────────────────────────────────

export class TypeOrmFirmRepository implements FirmRepository {
    private repo: Repository<FirmEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(FirmEntity);
    }

    async save(firm: Omit<Firm, 'createdAt'>): Promise<Firm> {
        const entity = this.repo.create(firm as DeepPartial<FirmEntity>);
        return this.repo.save(entity);
    }
}
