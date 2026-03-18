import { useQuery } from '@tanstack/react-query';
import {
    fetchClientDetail,
    fetchClientTransactions,
    fetchClientReconciliations,
    fetchClientJournalEntries,
    fetchClientQuestions,
} from '../../api/client';

/** Query key factory for client data */
export const clientKeys = {
    all: ['client'] as const,
    detail: (id: string) => [...clientKeys.all, 'detail', id] as const,
    transactions: (id: string) => [...clientKeys.all, 'transactions', id] as const,
    reconciliations: (id: string) => [...clientKeys.all, 'reconciliations', id] as const,
    journalEntries: (id: string) => [...clientKeys.all, 'journalEntries', id] as const,
    questions: (id: string) => [...clientKeys.all, 'questions', id] as const,
};

/** Client close detail — main overview data */
export function useClientDetail(clientId: string) {
    return useQuery({
        queryKey: clientKeys.detail(clientId),
        queryFn: () => fetchClientDetail(clientId),
        enabled: !!clientId,
    });
}

/** Client transactions — tab data, only fetches when tab is active */
export function useClientTransactions(clientId: string, enabled = true) {
    return useQuery({
        queryKey: clientKeys.transactions(clientId),
        queryFn: () => fetchClientTransactions(clientId),
        enabled: !!clientId && enabled,
    });
}

/** Client reconciliations */
export function useClientReconciliations(clientId: string, enabled = true) {
    return useQuery({
        queryKey: clientKeys.reconciliations(clientId),
        queryFn: () => fetchClientReconciliations(clientId),
        enabled: !!clientId && enabled,
    });
}

/** Client journal entries */
export function useClientJournalEntries(clientId: string, enabled = true) {
    return useQuery({
        queryKey: clientKeys.journalEntries(clientId),
        queryFn: () => fetchClientJournalEntries(clientId),
        enabled: !!clientId && enabled,
    });
}

/** Client questions */
export function useClientQuestions(clientId: string, enabled = true) {
    return useQuery({
        queryKey: clientKeys.questions(clientId),
        queryFn: () => fetchClientQuestions(clientId),
        enabled: !!clientId && enabled,
    });
}
