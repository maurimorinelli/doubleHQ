import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    categorizeTransaction,
    acceptAllAiSuggestions,
    aiCategorizeTransactions,
    aiFlagTransactions,
    aiGenerateQuestions,
    flagTransaction,
    unflagTransaction,
    updateTransactionAmount,
    addManualTransaction,
    deleteTransaction,
} from '../../api/client';
import { clientKeys } from '../queries/useClientDetail';
import { dashboardKeys } from '../queries/useDashboard';
import { useAppDispatch } from '../../store/store';
import { addToast } from '../../store/slices/uiSlice';
import type { ClientTransactionsResponse, TransactionItem } from '@doublehq/shared';

/**
 * useCategorizeTxn — Optimistic update example.
 * Updates the transaction status in the cache immediately,
 * then invalidates on success or rolls back on error.
 */
export function useCategorizeTxn(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: ({ txnId, category }: { txnId: string; category: string }) =>
            categorizeTransaction(clientId, txnId, category),

        // Optimistic update — instant UI feedback
        onMutate: async ({ txnId, category }) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.transactions(clientId) });

            const previousData = queryClient.getQueryData<ClientTransactionsResponse>(
                clientKeys.transactions(clientId),
            );

            if (previousData) {
                queryClient.setQueryData<ClientTransactionsResponse>(
                    clientKeys.transactions(clientId),
                    {
                        ...previousData,
                        transactions: previousData.transactions.map((t: TransactionItem) =>
                            t.id === txnId
                                ? { ...t, finalCategory: category, status: 'categorized' as TransactionItem['status'] }
                                : t,
                        ),
                    },
                );
            }

            return { previousData };
        },

        onError: (_err, _vars, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(clientKeys.transactions(clientId), context.previousData);
            }
            dispatch(addToast({ type: 'error', message: 'Failed to categorize transaction' }));
        },

        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Transaction categorized' }));
        },

        onSettled: () => {
            // Refetch to ensure server truth
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        },
    });
}

/** Accept all AI suggestions */
export function useAcceptAllSuggestions(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (closePeriodId: string) => acceptAllAiSuggestions(clientId, closePeriodId),
        onSuccess: (data) => {
            dispatch(addToast({ type: 'success', message: `${data.count} transactions accepted` }));
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Failed to accept suggestions' })),
    });
}

/** AI categorize all */
export function useAiCategorize(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (closePeriodId: string) => aiCategorizeTransactions(clientId, closePeriodId),
        onSuccess: (data) => {
            dispatch(addToast({ type: 'success', message: `${data.categorized} transactions categorized by AI` }));
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'AI categorization failed' })),
    });
}

/** AI flag transactions */
export function useAiFlag(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (closePeriodId: string) => aiFlagTransactions(clientId, closePeriodId),
        onSuccess: (data) => {
            dispatch(addToast({ type: 'success', message: `${data.flagged} transactions flagged` }));
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
            // AI flagging creates new unresolved flags — detail must refetch for AI Risk Assessment.
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'AI flagging failed' })),
    });
}

/** AI generate questions */
export function useAiQuestions(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (closePeriodId: string) => aiGenerateQuestions(clientId, closePeriodId),
        onSuccess: (data) => {
            dispatch(addToast({ type: 'success', message: `${data.questions} questions generated` }));
            queryClient.invalidateQueries({ queryKey: clientKeys.questions(clientId) });
            // AI question generation marks transactions as 'pending_client'
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Failed to generate questions' })),
    });
}

/** Manual flag */
export function useFlagTxn(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: ({ txnId, reason }: { txnId: string; reason: string }) =>
            flagTransaction(clientId, txnId, reason),
        onSuccess: () => {
            dispatch(addToast({ type: 'info', message: 'Transaction flagged' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
            // Flagging adds to unresolvedFlagsCount — detail must refetch for AI Risk Assessment.
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
    });
}

/** Unflag */
export function useUnflagTxn(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (txnId: string) => unflagTransaction(clientId, txnId),
        onSuccess: () => {
            dispatch(addToast({ type: 'info', message: 'Flag removed' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
            // Unflagging resolves the flag server-side — the Overview AI Risk Assessment
            // reads unresolvedFlagsCount from the detail query, so it must refetch too.
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
        },
    });
}

/** Update transaction amount */
export function useUpdateTxnAmount(clientId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ txnId, amount }: { txnId: string; amount: number }) =>
            updateTransactionAmount(clientId, txnId, amount),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
        },
    });
}

/** Add manual transaction */
export function useAddManualTxn(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (data: Parameters<typeof addManualTransaction>[1]) =>
            addManualTransaction(clientId, data),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Transaction added' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
        },
        onError: () => dispatch(addToast({ type: 'error', message: 'Failed to add transaction' })),
    });
}

/** Delete transaction */
export function useDeleteTxn(clientId: string) {
    const queryClient = useQueryClient();
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: (txnId: string) => deleteTransaction(clientId, txnId),
        onSuccess: () => {
            dispatch(addToast({ type: 'success', message: 'Transaction deleted' }));
            queryClient.invalidateQueries({ queryKey: clientKeys.transactions(clientId) });
        },
    });
}
