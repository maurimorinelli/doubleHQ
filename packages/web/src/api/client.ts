import type {
    ApiSuccessResponse,
    DashboardOverviewResponse,
    ClientCloseDetailResponse,
    InsightsResponse,
    TeamWorkloadResponse,
    ClientTransactionsResponse,
    ClientReconciliationsResponse,
    ClientJournalEntriesResponse,
    TaskItem,
    CreateClientRequest,
    CreateClientResponse,
} from '@doublehq/shared';

import { getStoredToken, clearAuthSession } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';
const API = `${API_BASE}/api`;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const token = getStoredToken();
    const headers: Record<string, string> = {
        ...(init?.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...init, headers });

    if (res.status === 401) {
        clearAuthSession();
        throw new Error('Session expired');
    }

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
    }
    const json = (await res.json()) as ApiSuccessResponse<T>;
    return json.data;
}

export function fetchDashboard(params?: {
    status?: string[];
    assignee?: string;
    sort?: string;
    period?: string;
}): Promise<DashboardOverviewResponse> {
    const qs = new URLSearchParams();
    if (params?.period) qs.set('period', params.period);
    if (params?.status?.length) qs.set('status', params.status.join(','));
    if (params?.assignee) qs.set('assignee', params.assignee);
    if (params?.sort) qs.set('sort', params.sort);
    const q = qs.toString();
    return fetchJson<DashboardOverviewResponse>(`${API}/dashboard/overview${q ? `?${q}` : ''}`);
}

export function fetchClientDetail(id: string): Promise<ClientCloseDetailResponse> {
    return fetchJson<ClientCloseDetailResponse>(`${API}/clients/${id}/close`);
}

export function fetchClientTransactions(id: string): Promise<ClientTransactionsResponse> {
    return fetchJson<ClientTransactionsResponse>(`${API}/clients/${id}/transactions`);
}

export function fetchClientReconciliations(id: string): Promise<ClientReconciliationsResponse> {
    return fetchJson<ClientReconciliationsResponse>(`${API}/clients/${id}/reconciliations`);
}

export function fetchClientJournalEntries(id: string): Promise<ClientJournalEntriesResponse> {
    return fetchJson<ClientJournalEntriesResponse>(`${API}/clients/${id}/journal-entries`);
}

export function updateTaskStatus(clientId: string, taskId: string, status: string): Promise<TaskItem> {
    return fetchJson<TaskItem>(`${API}/clients/${clientId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
}

export function fetchTemplates(): Promise<{ templates: Array<{ id: string; name: string; isDefault: boolean; sections: Array<{ name: string; tasks: Array<{ title: string }> }> }> }> {
    return fetchJson(`${API}/templates`);
}

export function startClose(clientId: string, templateId: string, period: string, preparerId?: string, reviewerId?: string): Promise<{ closePeriodId: string; totalTasks: number }> {
    return fetchJson(`${API}/clients/${clientId}/close/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, period, preparerId, reviewerId }),
    });
}

// ─── Team Management ─────────────────────────────────────────────

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
}

export function fetchTeamMembers(): Promise<{ members: TeamMember[] }> {
    return fetchJson(`${API}/team/members`);
}

export function createTeamMember(data: { name: string; email: string; role: string }): Promise<TeamMember> {
    return fetchJson(`${API}/team/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export function suggestAssignment(): Promise<{
    suggestedPreparer: { id: string; name: string; activeCloses: number } | null;
    suggestedReviewer: { id: string; name: string; activeCloses: number } | null;
}> {
    return fetchJson(`${API}/team/suggest-assignment`);
}

export function reassignClose(closePeriodId: string, preparerId: string, reviewerId: string): Promise<unknown> {
    return fetchJson(`${API}/close-periods/${closePeriodId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preparerId, reviewerId }),
    });
}

export function fetchInsights(): Promise<InsightsResponse> {
    return fetchJson<InsightsResponse>(`${API}/dashboard/insights`);
}

export function refreshInsights(): Promise<InsightsResponse> {
    return fetchJson<InsightsResponse>(`${API}/insights/refresh`, { method: 'POST' });
}

export function fetchTeamWorkload(): Promise<TeamWorkloadResponse> {
    return fetchJson<TeamWorkloadResponse>(`${API}/team/workload`);
}

// ─── Step 3: Transaction Categorization ──────────────────
export function categorizeTransaction(clientId: string, txnId: string, finalCategory: string): Promise<{ updated: boolean }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalCategory }),
    });
}

export function acceptAllAiSuggestions(clientId: string, closePeriodId: string): Promise<{ count: number }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/accept-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closePeriodId }),
    });
}

export function askClientQuestion(clientId: string, txnId: string, question: string): Promise<{ questionId: string }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/${txnId}/ask-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
    });
}

// ─── Step 4: Reconciliation ─────────────────────────────
export function reconcileAccount(clientId: string, reconId: string, bankBalance: number, notes?: string): Promise<{ reconciled: boolean; difference: number }> {
    return fetchJson(`${API}/clients/${clientId}/reconciliations/${reconId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankBalance, notes }),
    });
}

export function unresolveReconciliation(clientId: string, reconId: string): Promise<{ reopened: boolean }> {
    return fetchJson(`${API}/clients/${clientId}/reconciliations/${reconId}/reopen`, {
        method: 'POST',
    });
}

// ─── Step 5: Journal Entries ────────────────────────────
export function createJournalEntry(clientId: string, data: {
    closePeriodId: string;
    memo: string;
    type: string;
    date: string;
    lines: Array<{ accountName: string; debit: number; credit: number; description?: string }>;
}): Promise<{ entryId: string }> {
    return fetchJson(`${API}/clients/${clientId}/journal-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export function postJournalEntry(clientId: string, entryId: string): Promise<{ posted: boolean }> {
    return fetchJson(`${API}/clients/${clientId}/journal-entries/${entryId}/post`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
    });
}

// ─── Create Client ──────────────────────────────────────
export function createClient(data: CreateClientRequest): Promise<CreateClientResponse> {
    return fetchJson<CreateClientResponse>(`${API}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// ─── AI Bulk Actions ────────────────────────────────────
export function aiCategorizeTransactions(clientId: string, closePeriodId: string): Promise<{ categorized: number }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/ai-categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closePeriodId }),
    });
}

export function aiFlagTransactions(clientId: string, closePeriodId: string): Promise<{ flagged: number }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/ai-flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closePeriodId }),
    });
}

export function aiGenerateQuestions(clientId: string, closePeriodId: string): Promise<{ questions: number }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/ai-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closePeriodId }),
    });
}

export function flagTransaction(clientId: string, txnId: string, reason: string): Promise<{ flagged: boolean }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/${txnId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
    });
}

export function unflagTransaction(clientId: string, txnId: string): Promise<{ unflagged: boolean }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/${txnId}/unflag`, {
        method: 'POST',
    });
}

// ─── Client Questions ───────────────────────────────────
export function fetchClientQuestions(clientId: string): Promise<{
    questions: Array<{
        id: string;
        clientId: string;
        closePeriodId: string;
        question: string;
        category: string;
        status: string;
        transactionAmount: number;
        transactionVendor: string;
        transactionDate: string;
        sentAt: string;
        respondedAt: string | null;
        response: string | null;
    }>
}> {
    return fetchJson(`${API}/clients/${clientId}/questions`);
}

export function createGenericQuestion(clientId: string, question: string, category?: string): Promise<{ questionId: string }> {
    return fetchJson(`${API}/clients/${clientId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, category }),
    });
}

export function resolveQuestion(clientId: string, questionId: string, response: string): Promise<{ resolved: boolean }> {
    return fetchJson(`${API}/clients/${clientId}/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
    });
}

// ─── Transaction Adjustments ────────────────────────────
export function updateTransactionAmount(clientId: string, txnId: string, amount: number): Promise<{ updated: boolean }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/${txnId}/amount`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
    });
}

export function addManualTransaction(clientId: string, data: {
    closePeriodId: string;
    date: string;
    description: string;
    vendor: string;
    amount: number;
    type: 'debit' | 'credit';
    bankAccount: 'checking' | 'credit_card';
}): Promise<{ transaction: any }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export function deleteTransaction(clientId: string, txnId: string): Promise<{ deleted: boolean }> {
    return fetchJson(`${API}/clients/${clientId}/transactions/${txnId}`, {
        method: 'DELETE',
    });
}

// ─── Step 6: Sign-off ───────────────────────────────────
export function signOffClose(clientId: string, reviewNotes: string): Promise<{ locked: boolean; signedOffAt: string }> {
    return fetchJson(`${API}/clients/${clientId}/close/sign-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNotes }),
    });
}
