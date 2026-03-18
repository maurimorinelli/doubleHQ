import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useClientDetail } from '../hooks/queries/useClientDetail';
import { useTeamMembers } from '../hooks/queries/useTeam';
import { useUpdateTaskStatus, useReassignClose } from '../hooks/mutations/useCloseMutations';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setActiveClientTab } from '../store/slices/uiSlice';
import { setActiveClient, setActiveStep, markStepComplete } from '../store/slices/closeWorkflowSlice';
import { selectClientActiveTab, selectWorkflowProgress } from '../store/selectors';
import StatusBadge from '../components/ui/StatusBadge';
import ProgressBar from '../components/ui/ProgressBar';
import EmptyState from '../components/ui/EmptyState';
import type { TeamMember } from '../api/client';

import EmptyCloseState from './EmptyCloseState';
import OverviewTab from './tabs/OverviewTab';
import TransactionsTab from './tabs/TransactionsTab';
import QuestionsTab from './tabs/QuestionsTab';
import ReconciliationTab from './tabs/ReconciliationTab';
import AdjustmentsTab from './tabs/AdjustmentsTab';
import ReviewTab from './tabs/ReviewTab';

const TABS = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'transactions', label: 'Transactions', icon: 'receipt_long' },
    { key: 'questions', label: 'Questions', icon: 'chat' },
    { key: 'reconciliation', label: 'Reconciliation', icon: 'balance' },
    { key: 'adjustments', label: 'Adjustments', icon: 'edit_note' },
    { key: 'review', label: 'Review', icon: 'verified' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function TeamAssignment({ closePeriodId, preparerName, reviewerName }: {
    closePeriodId: string; preparerName: string; reviewerName: string;
}) {
    const [editing, setEditing] = useState(false);
    const { data: membersData } = useTeamMembers();
    const reassign = useReassignClose();
    const [prepId, setPrepId] = useState('');
    const [revId, setRevId] = useState('');

    const members: TeamMember[] = membersData?.members ?? [];

    const handleSave = () => {
        if (!prepId || !revId) return;
        reassign.mutate(
            { closePeriodId, preparerId: prepId, reviewerId: revId },
            { onSuccess: () => setEditing(false) },
        );
    };

    if (!editing) {
        return (
            <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-lg">
                    <span className="material-symbols-outlined text-sm text-primary">person</span>
                    <span className="text-xs font-semibold text-slate-700">Preparer:</span>
                    <span className="text-xs font-bold text-primary">{preparerName}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg">
                    <span className="material-symbols-outlined text-sm text-purple-600">verified_user</span>
                    <span className="text-xs font-semibold text-slate-700">Reviewer:</span>
                    <span className="text-xs font-bold text-purple-600">{reviewerName}</span>
                </div>
                <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-primary transition-colors"
                    title="Reassign team members"
                >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Reassign
                </button>
            </div>
        );
    }

    const preparers = members.filter(m => m.role === 'preparer');
    const reviewers = members.filter(m => m.role === 'manager' || m.role === 'reviewer');
    const prepOpts = preparers.length > 0 ? preparers : members;
    const revOpts = reviewers.length > 0 ? reviewers : members;

    return (
        <div className="flex items-center gap-3 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <select value={prepId} onChange={e => setPrepId(e.target.value)}
                className="text-xs font-semibold border border-slate-200 rounded px-2 py-1 bg-white"
            >
                <option value="">Preparer...</option>
                {prepOpts.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={revId} onChange={e => setRevId(e.target.value)}
                className="text-xs font-semibold border border-slate-200 rounded px-2 py-1 bg-white"
            >
                <option value="">Reviewer...</option>
                {revOpts.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button onClick={handleSave} disabled={reassign.isPending || !prepId || !revId}
                className="bg-primary text-white text-xs font-bold px-3 py-1 rounded hover:bg-primary/90 disabled:opacity-50"
            >
                {reassign.isPending ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs font-semibold text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
    );
}

export default function ClientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const dispatch = useAppDispatch();

    // Redux-persisted active tab per client
    const activeTab = useAppSelector(selectClientActiveTab(id!)) as TabKey;

    // Close workflow tracking — Redux knows which step we're on
    const workflowProgress = useAppSelector(selectWorkflowProgress);

    // TanStack Query for client data
    const { data, isLoading, error, refetch } = useClientDetail(id!);

    // Mutation hook for task status updates
    const updateTask = useUpdateTaskStatus(id!);

    // Track which client the workflow is for
    useEffect(() => {
        if (id) dispatch(setActiveClient(id));
    }, [id, dispatch]);

    const setTab = (tab: TabKey) => {
        dispatch(setActiveClientTab({ clientId: id!, tab }));
        const stepIndex = TABS.findIndex(t => t.key === tab);
        if (stepIndex >= 0) dispatch(setActiveStep(stepIndex));
    };

    const handleToggleTask = async (taskId: string, newStatus: string) => {
        updateTask.mutate({ taskId, status: newStatus }, {
            onSuccess: () => {
                // When a task is completed, mark the current workflow step as done
                if (newStatus === 'complete') {
                    const stepIndex = TABS.findIndex(t => t.key === activeTab);
                    if (stepIndex >= 0) dispatch(markStepComplete(stepIndex));
                }
            },
        });
    };

    if (isLoading) {
        return <EmptyState loading={true} error={null}><div /></EmptyState>;
    }

    if (error || !data) {
        return <EmptyState loading={false} error={error?.message ?? 'Failed to load client'}><div /></EmptyState>;
    }

    const { client, closePeriod, sections, riskAssessment, communications } = data;

    // ─── No active close → show empty state ───────────────
    if (!closePeriod) {
        return (
            <>
                <header className="bg-white border-b border-slate-200 px-8 py-4 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <Link to="/" className="flex items-center text-slate-500 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-xl">arrow_back</span>
                            <span className="text-sm font-medium ml-1">All Clients</span>
                        </Link>
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{client.name}</h1>
                    <p className="text-sm text-slate-500 mt-1">{client.industry} · {client.contactName}</p>
                </header>
                <div className="flex-1 flex overflow-hidden">
                    <EmptyCloseState
                        clientId={client.id}
                        clientName={client.name}
                        onCloseStarted={() => refetch()}
                    />
                </div>
            </>
        );
    }

    // ─── Active close → show tabs ──────────────────────────
    return (
        <>
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-8 py-4 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <Link to="/" className="flex items-center text-slate-500 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-xl">arrow_back</span>
                        <span className="text-sm font-medium ml-1">All Clients</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        {client.qboConnected && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold border border-green-100">
                                <span className="size-2 bg-green-500 rounded-full" />
                                Connected to QuickBooks Online
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{client.name}</h1>
                            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">{client.industry}</span>
                            <StatusBadge status={closePeriod.healthStatus} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">person</span>
                                {client.contactName}
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">calendar_today</span>
                                {closePeriod.period} Close
                            </div>
                        </div>
                        {/* Preparer / Reviewer — now using TQ hooks */}
                        <TeamAssignment closePeriodId={closePeriod.id} preparerName={closePeriod.preparerName} reviewerName={closePeriod.reviewerName} />
                    </div>
                    <div className="w-full max-w-md">
                        <ProgressBar
                            value={closePeriod.progress}
                            label="Close Progress"
                            colorScheme="primary"
                        />
                        <div className="flex justify-between mt-1">
                            <span className="text-[11px] font-bold text-slate-400">
                                Workflow step {workflowProgress.activeStep + 1}/{workflowProgress.totalSteps}
                                {workflowProgress.completedSteps.length > 0 && ` · ${workflowProgress.completedSteps.length} steps completed`}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                                {closePeriod.daysRemaining > 0 ? `${closePeriod.daysRemaining} days remaining` : `${Math.abs(closePeriod.daysRemaining)} days overdue`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation — persisted in Redux */}
                <nav className="flex items-center gap-1 mt-4 -mb-4 overflow-x-auto">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.key
                                ? 'text-primary border-primary'
                                : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Tab Content */}
            <div className="flex-1 flex overflow-hidden">
                {activeTab === 'overview' && riskAssessment && (
                    <OverviewTab
                        sections={sections}
                        riskAssessment={riskAssessment}
                        communications={communications}
                        onToggleTask={handleToggleTask}
                        onTaskNavigate={(targetTab) => setTab((targetTab as TabKey) || 'overview')}
                    />
                )}
                {activeTab === 'transactions' && <TransactionsTab clientId={id!} closePeriodId={closePeriod.id} onRefresh={refetch} />}
                {activeTab === 'questions' && <QuestionsTab clientId={id!} closePeriodId={closePeriod.id} onRefresh={refetch} />}
                {activeTab === 'reconciliation' && <ReconciliationTab clientId={id!} closePeriodId={closePeriod.id} onRefresh={refetch} />}
                {activeTab === 'adjustments' && <AdjustmentsTab clientId={id!} closePeriodId={closePeriod.id} onRefresh={refetch} />}
                {activeTab === 'review' && closePeriod && (
                    <ReviewTab sections={sections} riskAssessment={riskAssessment!} closePeriod={closePeriod} clientId={id!} onRefresh={refetch} />
                )}
            </div>
        </>
    );
}
