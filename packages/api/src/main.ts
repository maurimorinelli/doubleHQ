import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { AppDataSource } from './infrastructure/config/data-source';
import { createServer } from './presentation/server';
import { createRoutes } from './presentation/routes/api.routes';
import { createAuthRoutes } from './presentation/routes/auth.routes';
import { authMiddleware } from './presentation/middleware/auth.middleware';
import { ReassignCloseUseCase } from './application/use-cases/reassign-close';

// Domain
import { HealthScoreService } from './domain/services/health-score.service';

// Infrastructure (adapters)
import {
    TypeOrmClientRepository,
    TypeOrmClosePeriodRepository,
    TypeOrmCloseTaskRepository,
    TypeOrmClientQuestionRepository,
    TypeOrmTransactionFlagRepository,
    TypeOrmTeamMemberRepository,
    TypeOrmCachedInsightRepository,
    TypeOrmImportedTransactionRepository,
    TypeOrmReconciliationRepository,
    TypeOrmJournalEntryRepository,
    TypeOrmCloseTemplateRepository,
    TypeOrmAuthRepository,
    TypeOrmFirmRepository,
} from './infrastructure/database/repositories';

// Application (use cases)
import { GetDashboardOverviewUseCase } from './application/use-cases/get-dashboard-overview';
import { GetClientCloseDetailUseCase } from './application/use-cases/get-client-close-detail';
import { GetTeamWorkloadUseCase } from './application/use-cases/get-team-workload';
import { GetInsightsUseCase, RefreshInsightsUseCase } from './application/use-cases/get-insights';
import {
    GetClientTransactionsUseCase,
    GetClientReconciliationsUseCase,
    GetClientJournalEntriesUseCase,
    UpdateCloseTaskStatusUseCase,
} from './application/use-cases/get-client-detail-tab-data';
import { StartCloseUseCase, GetTemplatesUseCase } from './application/use-cases/start-close';
import { CategorizeTransactionUseCase } from './application/use-cases/categorize-transaction';
import { AskClientQuestionUseCase } from './application/use-cases/ask-client-question';
import { ReconcileAccountUseCase } from './application/use-cases/reconcile-account';
import { CreateJournalEntryUseCase, PostJournalEntryUseCase } from './application/use-cases/journal-entry';
import { SignOffCloseUseCase } from './application/use-cases/sign-off-close';
import { CreateClientUseCase } from './application/use-cases/create-client';
import { ClaudeDataGenerator } from './infrastructure/services/claude-data-generator';
import { ClaudeInsightGenerator } from './infrastructure/services/claude-insight-generator';
import { createPromptBuilder } from './application/use-cases/build-insights-prompt';
import { AiFlagTransactionsUseCase } from './application/use-cases/ai-flag-transactions';
import { AiGenerateQuestionsUseCase } from './application/use-cases/ai-generate-questions';
import { AdjustTransactionUseCase } from './application/use-cases/adjust-transaction';
import { ResolveClientQuestionUseCase } from './application/use-cases/resolve-client-question';
import { GetClientQuestionsUseCase } from './application/use-cases/get-client-questions';
import { CreateTeamMemberUseCase } from './application/use-cases/create-team-member';
import { SuggestTeamAssignmentUseCase } from './application/use-cases/suggest-team-assignment';
import { GetTeamMembersUseCase } from './application/use-cases/get-team-members';
import { LoginUseCase, RegisterUseCase, GetCurrentUserUseCase } from './application/use-cases/auth.use-cases';
import { createLogger } from '@doublehq/shared';

const logger = createLogger('API');

async function bootstrap() {
    // ─── Database ─────────────────────────────────────────
    logger.info('🔌 Connecting to database...');
    await AppDataSource.initialize();
    logger.info('✅ Database connected');

    // Run pending migrations
    await AppDataSource.runMigrations();
    logger.info('✅ Migrations applied');

    // ─── Dependency Injection (composition root) ──────────
    const clientRepo = new TypeOrmClientRepository(AppDataSource);
    const closePeriodRepo = new TypeOrmClosePeriodRepository(AppDataSource);
    const taskRepo = new TypeOrmCloseTaskRepository(AppDataSource);
    const questionRepo = new TypeOrmClientQuestionRepository(AppDataSource);
    const flagRepo = new TypeOrmTransactionFlagRepository(AppDataSource);
    const teamMemberRepo = new TypeOrmTeamMemberRepository(AppDataSource);
    const cachedInsightRepo = new TypeOrmCachedInsightRepository(AppDataSource);
    const txnRepo = new TypeOrmImportedTransactionRepository(AppDataSource);
    const reconRepo = new TypeOrmReconciliationRepository(AppDataSource);
    const jeRepo = new TypeOrmJournalEntryRepository(AppDataSource);
    const templateRepo = new TypeOrmCloseTemplateRepository(AppDataSource);
    const healthScoreService = new HealthScoreService();
    const authRepo = new TypeOrmAuthRepository(AppDataSource);
    const firmRepo = new TypeOrmFirmRepository(AppDataSource);

    // Use cases
    const getDashboardOverview = new GetDashboardOverviewUseCase(
        closePeriodRepo, clientRepo, questionRepo, flagRepo, healthScoreService
    );
    const getClientCloseDetail = new GetClientCloseDetailUseCase(
        clientRepo, closePeriodRepo, taskRepo, questionRepo, flagRepo
    );
    const getTeamWorkload = new GetTeamWorkloadUseCase(teamMemberRepo, closePeriodRepo);
    // AI Insight Generator — only create if API key is available
    const insightGenerator = process.env.ANTHROPIC_API_KEY
        ? new ClaudeInsightGenerator()
        : null;

    const promptBuilder = createPromptBuilder({
        clientRepo, closePeriodRepo, taskRepo,
        questionRepo, flagRepo, teamMemberRepo,
    });

    const getInsights = new GetInsightsUseCase(cachedInsightRepo, insightGenerator);
    const refreshInsights = new RefreshInsightsUseCase(
        cachedInsightRepo,
        insightGenerator,
        (firmId) => promptBuilder(firmId),
    );

    // New tab-level use cases
    const getClientTransactions = new GetClientTransactionsUseCase(clientRepo, closePeriodRepo, txnRepo, reconRepo);
    const getClientReconciliations = new GetClientReconciliationsUseCase(clientRepo, closePeriodRepo, reconRepo);
    const getClientJournalEntries = new GetClientJournalEntriesUseCase(clientRepo, closePeriodRepo, jeRepo);
    const updateCloseTaskStatus = new UpdateCloseTaskStatusUseCase(taskRepo, closePeriodRepo);
    const getTemplates = new GetTemplatesUseCase(templateRepo);
    const categorizeTransaction = new CategorizeTransactionUseCase(txnRepo, taskRepo, closePeriodRepo);
    const askClientQuestion = new AskClientQuestionUseCase(questionRepo, txnRepo, closePeriodRepo);
    const reconcileAccount = new ReconcileAccountUseCase(reconRepo, taskRepo, closePeriodRepo);
    const createJournalEntry = new CreateJournalEntryUseCase(jeRepo, closePeriodRepo);
    const postJournalEntry = new PostJournalEntryUseCase(jeRepo, taskRepo, closePeriodRepo);
    const signOffClose = new SignOffCloseUseCase(closePeriodRepo, taskRepo);

    // AI-powered use cases
    const aiDataGenerator = new ClaudeDataGenerator();
    const startClose = new StartCloseUseCase(clientRepo, closePeriodRepo, taskRepo, templateRepo, txnRepo, reconRepo, aiDataGenerator);
    const createClient = new CreateClientUseCase(
        clientRepo, closePeriodRepo, taskRepo, templateRepo,
        txnRepo, reconRepo, teamMemberRepo, aiDataGenerator,
    );
    const aiFlagTransactions = new AiFlagTransactionsUseCase(txnRepo, flagRepo, closePeriodRepo);
    const aiGenerateQuestions = new AiGenerateQuestionsUseCase(txnRepo, questionRepo, closePeriodRepo);
    const adjustTransaction = new AdjustTransactionUseCase(txnRepo, reconRepo, closePeriodRepo);
    const reassignClose = new ReassignCloseUseCase(closePeriodRepo, teamMemberRepo, taskRepo);
    const resolveClientQuestion = new ResolveClientQuestionUseCase(questionRepo, txnRepo, taskRepo, closePeriodRepo);
    const getClientQuestions = new GetClientQuestionsUseCase(questionRepo);
    const createTeamMember = new CreateTeamMemberUseCase(teamMemberRepo);
    const suggestTeamAssignment = new SuggestTeamAssignmentUseCase(teamMemberRepo, closePeriodRepo);
    const getTeamMembers = new GetTeamMembersUseCase(teamMemberRepo);

    // Auth use cases
    const login = new LoginUseCase(authRepo);
    const register = new RegisterUseCase(authRepo, firmRepo);
    const getCurrentUser = new GetCurrentUserUseCase(authRepo);

    // ─── Express App ──────────────────────────────────────
    const app = createServer();

    const routes = createRoutes({
        getDashboardOverview,
        getClientCloseDetail,
        getTeamWorkload,
        getInsights,
        refreshInsights,
        getClientTransactions,
        getClientReconciliations,
        getClientJournalEntries,
        updateCloseTaskStatus,
        startClose,
        getTemplates,
        categorizeTransaction,
        askClientQuestion,
        reconcileAccount,
        createJournalEntry,
        postJournalEntry,
        signOffClose,
        createClient,
        aiFlagTransactions,
        aiGenerateQuestions,
        adjustTransaction,
        reassignClose,
        resolveClientQuestion,
        getClientQuestions,
        createTeamMember,
        suggestTeamAssignment,
        getTeamMembers,
    });
    // Auth routes are PUBLIC (no middleware)
    const authRoutes = createAuthRoutes({ login, register, getCurrentUser });
    app.use('/api/auth', authRoutes);

    // Seed route — PUBLIC but protected by secret header
    app.post('/api/seed', async (req, res) => {
        try {
            const secret = req.headers['x-seed-secret'];
            if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
                res.status(403).json({ error: 'Forbidden' });
                return;
            }
            const password = req.body?.password;
            if (!password) {
                res.status(400).json({ error: 'password field required' });
                return;
            }
            const { runSeed } = await import('./infrastructure/database/seeds/seed-data');
            const result = await runSeed(AppDataSource, password);
            res.json({ success: true, message: result });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    // All other /api routes are PROTECTED by auth middleware
    app.use('/api', authMiddleware, routes);

    // ─── Start ────────────────────────────────────────────
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        logger.info(`🚀 API server running on http://localhost:${port}`);
        logger.info(`📊 Dashboard:       http://localhost:${port}/api/dashboard/overview`);
        logger.info(`🤖 Insights:        http://localhost:${port}/api/dashboard/insights`);
        logger.info(`👥 Team:            http://localhost:${port}/api/team/workload`);
        logger.info(`📄 Transactions:    http://localhost:${port}/api/clients/:id/transactions`);
        logger.info(`🔄 Reconciliations: http://localhost:${port}/api/clients/:id/reconciliations`);
        logger.info(`📒 Journal Entries: http://localhost:${port}/api/clients/:id/journal-entries`);
    });
}

bootstrap().catch(err => {
    logger.error('❌ Failed to start', err);
    process.exit(1);
});
