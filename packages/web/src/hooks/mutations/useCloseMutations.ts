import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    startClose,
    signOffClose,
    reassignClose,
    createTeamMember,
    createClient,
    reconcileAccount,
    unresolveReconciliation,
    createJournalEntry,
    postJournalEntry,
    updateTaskStatus,
    resolveQuestion,
    createGenericQuestion,
    refreshInsights,
} from '../../api/client';
import { clientKeys } from '../queries/useClientDetail';
import { dashboardKeys } from '../queries/useDashboard';
import { teamKeys, insightsKeys } from '../queries/useTeam';
import { useAppDispatch } from '../../store/store';
import { addToast } from '../../store/slices/uiSlice';

/** Start a close period */
export function useStartClose(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: ({ templateId, period, preparerId, reviewerId }: {
            templateId: string; period: string; preparerId?: string; reviewerId?: string;
        }) => startClose(clientId, templateId, period, preparerId, reviewerId),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Close period started' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
            queryClient.invalidateQueries({ queryKey: teamKeys.workload() });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Failed to start close' })),
    });
}

/** Sign off & lock close */
export function useSignOff(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (reviewNotes: string) => signOffClose(clientId, reviewNotes),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Close signed off and locked' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Failed to sign off' })),
    });
}

/** Reassign close period preparer/reviewer */
export function useReassignClose() {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: ({ closePeriodId, preparerId, reviewerId }: {
            closePeriodId: string; preparerId: string; reviewerId: string;
        }) => reassignClose(closePeriodId, preparerId, reviewerId),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Team reassigned' }));
            // Invalidate broadly — reassignment affects detail + team workload
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
            queryClient.invalidateQueries({ queryKey: teamKeys.workload() });
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Failed to reassign' })),
    });
}

/** Create team member */
export function useCreateTeamMember() {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (data: { name: string; email: string; role: string }) =>
            createTeamMember(data),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Team member added' }));
            queryClient.invalidateQueries({ queryKey: teamKeys.all });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Failed to add member' })),
    });
}

/** Create client */
export function useCreateClient() {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: createClient,
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Client created' }));
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Failed to create client' })),
    });
}

/** Reconcile account */
export function useReconcile(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: ({ reconId, bankBalance, notes }: { reconId: string; bankBalance: number; notes?: string }) =>
            reconcileAccount(clientId, reconId, bankBalance, notes),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Account reconciled' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.reconciliations(clientId) });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Reconciliation failed' })),
    });
}

/** Reopen reconciliation */
export function useReopenRecon(clientId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (reconId: string) => unresolveReconciliation(clientId, reconId),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.reconciliations(clientId) });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
    });
}

/** Create journal entry */
export function useCreateJournalEntry(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (data: Parameters<typeof createJournalEntry>[1]) =>
            createJournalEntry(clientId, data),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Journal entry created' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.journalEntries(clientId) });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Failed to create entry' })),
    });
}

/** Post journal entry */
export function usePostJournalEntry(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (entryId: string) => postJournalEntry(clientId, entryId),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Entry posted' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.journalEntries(clientId) });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
    });
}

/** Update task status */
export function useUpdateTaskStatus(clientId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
            updateTaskStatus(clientId, taskId, status),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        },
    });
}

/** Resolve question */
export function useResolveQuestion(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: ({ questionId, response }: { questionId: string; response: string }) =>
            resolveQuestion(clientId, questionId, response),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Question resolved' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.questions(clientId) });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
            // Resolving a question reverts the linked transaction from 'pending_client',
            // so the Transactions tab must refetch to reflect the updated status.
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
        },
    });
}

/** Create generic question */
export function useCreateQuestion(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: ({ question, category }: { question: string; category?: string }) =>
            createGenericQuestion(clientId, question, category),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Question sent to client' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.questions(clientId) });
        },
    });
}

/** Refresh insights */
export function useRefreshInsights() {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: refreshInsights,
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Insights refreshed' }));
            queryClient.invalidateQueries({ queryKey: insightsKeys.all });
        },
    });
}
