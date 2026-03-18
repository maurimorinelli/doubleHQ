import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest, RequestWithId, ValidatedQueryRequest } from '../types/request-types';
import { GetDashboardOverviewUseCase } from '../../application/use-cases/get-dashboard-overview';
import { GetClientCloseDetailUseCase } from '../../application/use-cases/get-client-close-detail';
import { GetTeamWorkloadUseCase } from '../../application/use-cases/get-team-workload';
import { GetInsightsUseCase, RefreshInsightsUseCase } from '../../application/use-cases/get-insights';
import {
    GetClientTransactionsUseCase,
    GetClientReconciliationsUseCase,
    GetClientJournalEntriesUseCase,
    UpdateCloseTaskStatusUseCase,
} from '../../application/use-cases/get-client-detail-tab-data';
import { StartCloseUseCase, GetTemplatesUseCase } from '../../application/use-cases/start-close';
import { CategorizeTransactionUseCase } from '../../application/use-cases/categorize-transaction';
import { AskClientQuestionUseCase } from '../../application/use-cases/ask-client-question';
import { ReconcileAccountUseCase } from '../../application/use-cases/reconcile-account';
import { CreateJournalEntryUseCase, PostJournalEntryUseCase } from '../../application/use-cases/journal-entry';
import { SignOffCloseUseCase } from '../../application/use-cases/sign-off-close';
import { CreateClientUseCase } from '../../application/use-cases/create-client';
import { AiFlagTransactionsUseCase } from '../../application/use-cases/ai-flag-transactions';
import { AiGenerateQuestionsUseCase } from '../../application/use-cases/ai-generate-questions';
import { AdjustTransactionUseCase } from '../../application/use-cases/adjust-transaction';
import { ReassignCloseUseCase } from '../../application/use-cases/reassign-close';
import { GetClientQuestionsUseCase } from '../../application/use-cases/get-client-questions';
import { ResolveClientQuestionUseCase } from '../../application/use-cases/resolve-client-question';
import { CreateTeamMemberUseCase } from '../../application/use-cases/create-team-member';
import { SuggestTeamAssignmentUseCase } from '../../application/use-cases/suggest-team-assignment';
import { GetTeamMembersUseCase } from '../../application/use-cases/get-team-members';

import { validateBody, validateQuery } from '../validation/middleware';
import {
    CreateClientSchema,
    StartCloseSchema,
    UpdateTaskStatusSchema,
    CategorizeTransactionSchema,
    ClosePeriodIdSchema,
    ManualFlagSchema,
    AskClientQuestionSchema,
    ResolveQuestionSchema,
    ReconcileAccountSchema,
    AdjustAmountSchema,
    AddManualTransactionSchema,
    CreateJournalEntrySchema,
    SignOffCloseSchema,
    CreateTeamMemberSchema,
    ReassignCloseSchema,
    DashboardQuerySchema,
} from '../validation/schemas';

function getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const closeMonth = now.getDate() <= 15 ? month : month + 1;
    const adjustedMonth = closeMonth === 0 ? 12 : closeMonth;
    const adjustedYear = closeMonth === 0 ? year - 1 : year;
    return `${adjustedYear}-${String(adjustedMonth).padStart(2, '0')}`;
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res).catch(next);
    };
}

function jsonResponse(res: Response, req: Request, data: unknown) {
    res.json({
        data,
        meta: { timestamp: new Date().toISOString(), requestId: (req as RequestWithId).requestId },
    });
}

export interface RouteDependencies {
    getDashboardOverview: GetDashboardOverviewUseCase;
    getClientCloseDetail: GetClientCloseDetailUseCase;
    getTeamWorkload: GetTeamWorkloadUseCase;
    getInsights: GetInsightsUseCase;
    refreshInsights: RefreshInsightsUseCase;
    getClientTransactions: GetClientTransactionsUseCase;
    getClientReconciliations: GetClientReconciliationsUseCase;
    getClientJournalEntries: GetClientJournalEntriesUseCase;
    updateCloseTaskStatus: UpdateCloseTaskStatusUseCase;
    startClose: StartCloseUseCase;
    getTemplates: GetTemplatesUseCase;
    categorizeTransaction: CategorizeTransactionUseCase;
    askClientQuestion: AskClientQuestionUseCase;
    reconcileAccount: ReconcileAccountUseCase;
    createJournalEntry: CreateJournalEntryUseCase;
    postJournalEntry: PostJournalEntryUseCase;
    signOffClose: SignOffCloseUseCase;
    createClient: CreateClientUseCase;
    aiFlagTransactions: AiFlagTransactionsUseCase;
    aiGenerateQuestions: AiGenerateQuestionsUseCase;
    adjustTransaction: AdjustTransactionUseCase;
    reassignClose: ReassignCloseUseCase;
    getClientQuestions: GetClientQuestionsUseCase;
    resolveClientQuestion: ResolveClientQuestionUseCase;
    createTeamMember: CreateTeamMemberUseCase;
    suggestTeamAssignment: SuggestTeamAssignmentUseCase;
    getTeamMembers: GetTeamMembersUseCase;
}

export function createRoutes(deps: RouteDependencies): Router {
    const router = Router();

    // ─── Create Client ──────────────────────────────
    router.post('/clients', validateBody(CreateClientSchema), wrap(async (req, res) => {
        const { firmId } = (req as AuthRequest).user;
        const result = await deps.createClient.execute(firmId, req.body);
        jsonResponse(res, req, result);
    }));

    // ─── Dashboard ───────────────────────────────────
    router.get('/dashboard/overview', validateQuery(DashboardQuerySchema), wrap(async (req, res) => {
        const q = (req as ValidatedQueryRequest).validatedQuery;
        const statusFilter = (q as Record<string, string>).status ? (q as Record<string, string>).status.split(',') : undefined;
        const result = await deps.getDashboardOverview.execute(
            (req as AuthRequest).user.firmId,
            (q as Record<string, string>).period,
            { status: statusFilter, assignee: (q as Record<string, string>).assignee, sort: (q as Record<string, string>).sort },
        );
        jsonResponse(res, req, result);
    }));

    // ─── Insights ────────────────────────────────────
    router.get('/dashboard/insights', wrap(async (req, res) => {
        const result = await deps.getInsights.execute((req as AuthRequest).user.firmId);
        jsonResponse(res, req, result);
    }));

    router.post('/insights/refresh', wrap(async (req, res) => {
        const result = await deps.refreshInsights.execute((req as AuthRequest).user.firmId);
        jsonResponse(res, req, result);
    }));

    // ─── Client Close Detail ─────────────────────────
    router.get('/clients/:id/close', wrap(async (req, res) => {
        const result = await deps.getClientCloseDetail.execute(req.params.id as string);
        jsonResponse(res, req, result);
    }));

    // ─── Client Transactions ─────────────────────────
    router.get('/clients/:id/transactions', wrap(async (req, res) => {
        const result = await deps.getClientTransactions.execute(req.params.id as string);
        jsonResponse(res, req, result);
    }));

    // ─── Client Reconciliations ──────────────────────
    router.get('/clients/:id/reconciliations', wrap(async (req, res) => {
        const result = await deps.getClientReconciliations.execute(req.params.id as string);
        jsonResponse(res, req, result);
    }));

    // ─── Client Journal Entries ──────────────────────
    router.get('/clients/:id/journal-entries', wrap(async (req, res) => {
        const result = await deps.getClientJournalEntries.execute(req.params.id as string);
        jsonResponse(res, req, result);
    }));

    // ─── Update Task Status ──────────────────────────
    router.patch('/clients/:id/tasks/:taskId', validateBody(UpdateTaskStatusSchema), wrap(async (req, res) => {
        const result = await deps.updateCloseTaskStatus.execute(req.params.taskId as string, req.body.status);
        jsonResponse(res, req, result);
    }));

    // ─── Templates ───────────────────────────────────
    router.get('/templates', wrap(async (req, res) => {
        const { firmId } = (req as AuthRequest).user;
        const result = await deps.getTemplates.execute(firmId);
        jsonResponse(res, req, result);
    }));

    // ─── Start Close ─────────────────────────────────
    router.post('/clients/:id/close/start', validateBody(StartCloseSchema), wrap(async (req, res) => {
        const result = await deps.startClose.execute(req.params.id as string, req.body);
        jsonResponse(res, req, result);
    }));

    // ─── Categorize Transaction ──────────────────────
    router.patch('/clients/:id/transactions/:txnId', validateBody(CategorizeTransactionSchema), wrap(async (req, res) => {
        const result = await deps.categorizeTransaction.execute(req.params.txnId as string, { finalCategory: req.body.finalCategory });
        jsonResponse(res, req, result);
    }));

    // ─── Accept All AI Suggestions ───────────────────
    router.post('/clients/:id/transactions/accept-all', validateBody(ClosePeriodIdSchema), wrap(async (req, res) => {
        const result = await deps.categorizeTransaction.acceptAllAiSuggestions(req.body.closePeriodId);
        jsonResponse(res, req, result);
    }));

    // ─── AI Categorize All ───────────────────────────
    router.post('/clients/:id/transactions/ai-categorize', validateBody(ClosePeriodIdSchema), wrap(async (req, res) => {
        const result = await deps.categorizeTransaction.aiCategorizeAll(req.body.closePeriodId);
        jsonResponse(res, req, result);
    }));

    // ─── AI Flag Transactions ────────────────────────
    router.post('/clients/:id/transactions/ai-flag', validateBody(ClosePeriodIdSchema), wrap(async (req, res) => {
        const result = await deps.aiFlagTransactions.execute(req.params.id as string, req.body.closePeriodId);
        jsonResponse(res, req, result);
    }));

    // ─── AI Generate Questions ───────────────────────
    router.post('/clients/:id/transactions/ai-questions', validateBody(ClosePeriodIdSchema), wrap(async (req, res) => {
        const result = await deps.aiGenerateQuestions.execute(req.params.id as string, req.body.closePeriodId);
        jsonResponse(res, req, result);
    }));

    // ─── Manual Flag Transaction ─────────────────────
    router.post('/clients/:id/transactions/:txnId/flag', validateBody(ManualFlagSchema), wrap(async (req, res) => {
        const result = await deps.aiFlagTransactions.manualFlag(
            req.params.id as string, req.params.txnId as string, req.body.reason || 'Manually flagged for review',
        );
        jsonResponse(res, req, result);
    }));

    // ─── Unflag Transaction ──────────────────────────
    router.post('/clients/:id/transactions/:txnId/unflag', wrap(async (req, res) => {
        const result = await deps.aiFlagTransactions.unflag(req.params.id as string, req.params.txnId as string);
        jsonResponse(res, req, result);
    }));

    // ─── Client Questions ────────────────────────────
    router.get('/clients/:id/questions', wrap(async (req, res) => {
        const result = await deps.getClientQuestions.execute(req.params.id as string);
        jsonResponse(res, req, result);
    }));

    router.post('/clients/:id/questions', validateBody(AskClientQuestionSchema), wrap(async (req, res) => {
        const result = await deps.askClientQuestion.createGenericQuestion(req.params.id as string, req.body);
        jsonResponse(res, req, result);
    }));

    router.patch('/clients/:id/questions/:questionId', validateBody(ResolveQuestionSchema), wrap(async (req, res) => {
        const result = await deps.resolveClientQuestion.execute(
            req.params.id as string, req.params.questionId as string, req.body.response,
        );
        jsonResponse(res, req, result);
    }));

    // ─── Ask Client Question (linked to transaction) ─
    router.post('/clients/:id/transactions/:txnId/ask-client', validateBody(AskClientQuestionSchema), wrap(async (req, res) => {
        const result = await deps.askClientQuestion.execute(req.params.id as string, req.params.txnId as string, { question: req.body.question });
        jsonResponse(res, req, result);
    }));

    // ─── Reconcile Account ───────────────────────────
    router.patch('/clients/:id/reconciliations/:reconId', validateBody(ReconcileAccountSchema), wrap(async (req, res) => {
        const result = await deps.reconcileAccount.execute(req.params.reconId as string, req.body);
        jsonResponse(res, req, result);
    }));

    // ─── Re-open Reconciliation ──────────────────────
    router.post('/clients/:id/reconciliations/:reconId/reopen', wrap(async (req, res) => {
        await deps.reconcileAccount.reopen(req.params.reconId as string);
        jsonResponse(res, req, { reopened: true });
    }));

    // ─── Adjust Transaction Amount ───────────────────
    router.patch('/clients/:id/transactions/:txnId/amount', validateBody(AdjustAmountSchema), wrap(async (req, res) => {
        const result = await deps.adjustTransaction.updateAmount(req.params.txnId as string, req.body.amount);
        jsonResponse(res, req, result);
    }));

    // ─── Add Manual Transaction ──────────────────────
    router.post('/clients/:id/transactions/manual', validateBody(AddManualTransactionSchema), wrap(async (req, res) => {
        const result = await deps.adjustTransaction.addManual(req.params.id as string, req.body);
        jsonResponse(res, req, result);
    }));

    // ─── Delete Manual Transaction ───────────────────
    router.delete('/clients/:id/transactions/:txnId', wrap(async (req, res) => {
        const result = await deps.adjustTransaction.deleteManual(req.params.txnId as string);
        jsonResponse(res, req, result);
    }));

    // ─── Create Journal Entry ────────────────────────
    router.post('/clients/:id/journal-entries', validateBody(CreateJournalEntrySchema), wrap(async (req, res) => {
        const result = await deps.createJournalEntry.execute(req.params.id as string, req.body);
        jsonResponse(res, req, result);
    }));

    // ─── Post Journal Entry ──────────────────────────
    router.patch('/clients/:id/journal-entries/:entryId/post', wrap(async (req, res) => {
        const result = await deps.postJournalEntry.execute(req.params.entryId as string);
        jsonResponse(res, req, result);
    }));

    // ─── Sign Off & Lock Close ───────────────────────
    router.post('/clients/:id/close/sign-off', validateBody(SignOffCloseSchema), wrap(async (req, res) => {
        const result = await deps.signOffClose.execute(req.params.id as string, { reviewNotes: req.body.reviewNotes });
        jsonResponse(res, req, result);
    }));

    // ─── Team Workload ───────────────────────────────
    router.get('/team/workload', wrap(async (req, res) => {
        const period = (req.query.period as string) || getCurrentPeriod();
        const result = await deps.getTeamWorkload.execute((req as AuthRequest).user.firmId, period);
        jsonResponse(res, req, result);
    }));

    // ─── Team Members CRUD ───────────────────────────
    router.get('/team/members', wrap(async (req, res) => {
        const { firmId } = (req as AuthRequest).user;
        const result = await deps.getTeamMembers.execute(firmId);
        jsonResponse(res, req, result);
    }));

    router.post('/team/members', validateBody(CreateTeamMemberSchema), wrap(async (req, res) => {
        const { firmId } = (req as AuthRequest).user;
        const result = await deps.createTeamMember.execute(firmId, req.body);
        jsonResponse(res, req, result);
    }));

    // ─── AI Team Assignment Suggestion ────────────────
    router.get('/team/suggest-assignment', wrap(async (req, res) => {
        const { firmId } = (req as AuthRequest).user;
        const result = await deps.suggestTeamAssignment.execute(firmId);
        jsonResponse(res, req, result);
    }));

    // ─── Reassign Close Period ────────────────────────
    router.patch('/close-periods/:id/assign', validateBody(ReassignCloseSchema), wrap(async (req, res) => {
        const result = await deps.reassignClose.execute(req.params.id as string, req.body.preparerId, req.body.reviewerId);
        jsonResponse(res, req, result);
    }));

    // ─── Seed Endpoint (protected by secret) ───────────
    router.post('/seed', wrap(async (req, res) => {
        const secret = req.headers['x-seed-secret'];
        const expectedSecret = process.env.SEED_SECRET;

        if (!expectedSecret || secret !== expectedSecret) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const password = req.body?.password;
        if (!password) {
            res.status(400).json({ error: 'password field is required in request body' });
            return;
        }

        const { runSeed } = await import('../../infrastructure/database/seeds/seed-data');
        const { AppDataSource } = await import('../../infrastructure/config/data-source');
        const result = await runSeed(AppDataSource, password);
        res.json({ success: true, message: result });
    }));

    return router;
}
