import { describe, it, expect } from 'vitest';
import { deriveQuestionStatus, computeSignOffReadiness } from '../src/utils/close-utils';
import type { WorkflowSectionData } from '@doublehq/shared';
import { clientKeys } from '../src/hooks/queries/useClientDetail';
import { dashboardKeys } from '../src/hooks/queries/useDashboard';
import { teamKeys, insightsKeys } from '../src/hooks/queries/useTeam';
import {
    selectActiveFilterCount,
    selectHasActiveFilters,
    selectClientActiveTab,
    selectWorkflowProgress,
} from '../src/store/selectors/index';

// ─────────────────────────────────────────────────────────
// Query Key Factory Tests
// ─────────────────────────────────────────────────────────

describe('clientKeys factory', () => {
    it('produces unique keys per client', () => {
        const a = clientKeys.detail('client_1');
        const b = clientKeys.detail('client_2');
        expect(a).not.toEqual(b);
        expect(a).toEqual(['client', 'detail', 'client_1']);
        expect(b).toEqual(['client', 'detail', 'client_2']);
    });

    it('all sub-keys share the "client" root for bulk invalidation', () => {
        const root = clientKeys.all;
        expect(clientKeys.detail('x')[0]).toBe(root[0]);
        expect(clientKeys.transactions('x')[0]).toBe(root[0]);
        expect(clientKeys.reconciliations('x')[0]).toBe(root[0]);
        expect(clientKeys.journalEntries('x')[0]).toBe(root[0]);
        expect(clientKeys.questions('x')[0]).toBe(root[0]);
    });

    it('produces distinct keys for each data type', () => {
        const id = 'test_client';
        const keys = [
            clientKeys.detail(id),
            clientKeys.transactions(id),
            clientKeys.reconciliations(id),
            clientKeys.journalEntries(id),
            clientKeys.questions(id),
        ];
        // All should be unique
        const serialized = keys.map(k => JSON.stringify(k));
        expect(new Set(serialized).size).toBe(keys.length);
    });
});

describe('dashboardKeys factory', () => {
    it('overview key includes filters for cache separation', () => {
        const noFilter = dashboardKeys.overview({});
        const withFilter = dashboardKeys.overview({ status: ['on_track'], assignee: 'tm_001' });
        expect(noFilter).not.toEqual(withFilter);
        expect(noFilter[0]).toBe('dashboard');
        expect(noFilter[1]).toBe('overview');
    });
});

describe('teamKeys factory', () => {
    it('workload and members produce distinct keys', () => {
        expect(teamKeys.workload()).not.toEqual(teamKeys.members());
        expect(teamKeys.workload()).toEqual(['team', 'workload']);
        expect(teamKeys.members()).toEqual(['team', 'members']);
    });

    it('insightsKeys are independent from teamKeys', () => {
        expect(insightsKeys.all[0]).toBe('insights');
        expect(teamKeys.all[0]).toBe('team');
    });
});

// ─────────────────────────────────────────────────────────
// Redux Selector Tests
// ─────────────────────────────────────────────────────────

describe('selectActiveFilterCount', () => {
    const baseState = {
        dashboardFilters: {
            statusFilters: [] as string[],
            assignee: null as string | null,
            sort: 'health',
            period: null as string | null,
        },
        ui: { activeClientTabs: {}, toasts: [] },
        closeWorkflow: { activeStep: 0, completedSteps: [], clientId: null },
    };

    it('returns 0 when no filters active', () => {
        expect(selectActiveFilterCount(baseState as any)).toBe(0);
    });

    it('counts each filter type independently', () => {
        const withStatus = {
            ...baseState,
            dashboardFilters: { ...baseState.dashboardFilters, statusFilters: ['on_track', 'behind'] },
        };
        expect(selectActiveFilterCount(withStatus as any)).toBe(2); // 2 status filters

        const withAll = {
            ...baseState,
            dashboardFilters: {
                statusFilters: ['on_track'],
                assignee: 'tm_001',
                sort: 'deadline',
                period: '2026-02',
            },
        };
        expect(selectActiveFilterCount(withAll as any)).toBe(4); // 1 status + assignee + sort + period
    });
});

describe('selectHasActiveFilters', () => {
    it('returns false for default state', () => {
        const state = {
            dashboardFilters: { statusFilters: [], assignee: null, sort: 'health', period: null },
            ui: { activeClientTabs: {}, toasts: [] },
            closeWorkflow: { activeStep: 0, completedSteps: [], clientId: null },
        };
        expect(selectHasActiveFilters(state as any)).toBe(false);
    });

    it('returns true when any filter is active', () => {
        const state = {
            dashboardFilters: { statusFilters: ['behind'], assignee: null, sort: 'health', period: null },
            ui: { activeClientTabs: {}, toasts: [] },
            closeWorkflow: { activeStep: 0, completedSteps: [], clientId: null },
        };
        expect(selectHasActiveFilters(state as any)).toBe(true);
    });
});

describe('selectClientActiveTab', () => {
    it('returns "overview" as default for unknown client', () => {
        const state = {
            dashboardFilters: { statusFilters: [], assignee: null, sort: 'health', period: null },
            ui: { activeClientTabs: {}, toasts: [] },
            closeWorkflow: { activeStep: 0, completedSteps: [], clientId: null },
        };
        expect(selectClientActiveTab('unknown_client')(state as any)).toBe('overview');
    });

    it('returns persisted tab for known client', () => {
        const state = {
            dashboardFilters: { statusFilters: [], assignee: null, sort: 'health', period: null },
            ui: { activeClientTabs: { 'client_1': 'transactions' }, toasts: [] },
            closeWorkflow: { activeStep: 0, completedSteps: [], clientId: null },
        };
        expect(selectClientActiveTab('client_1')(state as any)).toBe('transactions');
    });
});

describe('selectWorkflowProgress', () => {
    it('computes progress from completed steps', () => {
        const state = {
            dashboardFilters: { statusFilters: [], assignee: null, sort: 'health', period: null },
            ui: { activeClientTabs: {}, toasts: [] },
            closeWorkflow: { activeStep: 2, completedSteps: [0, 1], clientId: 'c1' },
        };
        const result = selectWorkflowProgress(state as any);
        expect(result.activeStep).toBe(2);
        expect(result.completedSteps).toEqual([0, 1]);
        expect(result.totalSteps).toBe(6);
        expect(result.progressPercent).toBe(33); // 2/6 = 33%
    });

    it('returns 0% for fresh workflow', () => {
        const state = {
            dashboardFilters: { statusFilters: [], assignee: null, sort: 'health', period: null },
            ui: { activeClientTabs: {}, toasts: [] },
            closeWorkflow: { activeStep: 0, completedSteps: [], clientId: null },
        };
        const result = selectWorkflowProgress(state as any);
        expect(result.progressPercent).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────
// Business Logic: Question Status Derivation
// ─────────────────────────────────────────────────────────

describe('deriveQuestionStatus', () => {
    // Fixed reference point: March 17, 2026 12:00 UTC
    const NOW = new Date('2026-03-17T12:00:00Z').getTime();

    it('responded question → always "answered" regardless of age', () => {
        const result = deriveQuestionStatus({
            status: 'pending',
            respondedAt: '2026-03-16T10:00:00Z',
            sentAt: '2026-03-01T10:00:00Z', // 16 days ago, but has response
        }, NOW);
        expect(result.status).toBe('answered');
        expect(result.priority).toBe('normal');
    });

    it('pending question sent 1 day ago → "pending", priority "normal"', () => {
        const result = deriveQuestionStatus({
            status: 'pending',
            respondedAt: null,
            sentAt: '2026-03-16T12:00:00Z', // 1 day ago
        }, NOW);
        expect(result.status).toBe('pending');
        expect(result.priority).toBe('normal');
    });

    it('pending question sent exactly 3 days ago → still "pending" (boundary)', () => {
        const result = deriveQuestionStatus({
            status: 'pending',
            respondedAt: null,
            sentAt: '2026-03-14T12:00:00Z', // exactly 3.0 days
        }, NOW);
        expect(result.status).toBe('pending');
        expect(result.priority).toBe('normal');
    });

    it('pending question sent 3+ days ago → "overdue", priority "urgent"', () => {
        const result = deriveQuestionStatus({
            status: 'pending',
            respondedAt: null,
            sentAt: '2026-03-14T11:00:00Z', // 3.04 days ago
        }, NOW);
        expect(result.status).toBe('overdue');
        expect(result.priority).toBe('urgent');
    });

    it('pending question sent 30 days ago → "overdue"', () => {
        const result = deriveQuestionStatus({
            status: 'pending',
            respondedAt: null,
            sentAt: '2026-02-15T12:00:00Z',
        }, NOW);
        expect(result.status).toBe('overdue');
        expect(result.priority).toBe('urgent');
    });

    it('respondedAt wins even if question is very old', () => {
        const result = deriveQuestionStatus({
            status: 'overdue',
            respondedAt: '2026-03-17T10:00:00Z',
            sentAt: '2026-01-01T00:00:00Z', // 75 days old
        }, NOW);
        expect(result.status).toBe('answered');
        expect(result.priority).toBe('normal');
    });

    it('pre-existing "overdue" status from API is preserved with urgent priority', () => {
        const result = deriveQuestionStatus({
            status: 'overdue',
            respondedAt: null,
            sentAt: '2026-03-17T10:00:00Z', // very recent, but API says overdue
        }, NOW);
        expect(result.status).toBe('overdue');
        expect(result.priority).toBe('urgent');
    });

    it('future sentAt date → remains "pending"', () => {
        const result = deriveQuestionStatus({
            status: 'pending',
            respondedAt: null,
            sentAt: '2026-03-20T12:00:00Z', // 3 days in the future
        }, NOW);
        expect(result.status).toBe('pending');
        expect(result.priority).toBe('normal');
    });
});

// ─────────────────────────────────────────────────────────
// Business Logic: Sign-off Readiness Checklist
// ─────────────────────────────────────────────────────────

// Factory: creates a section with configurable completion and blocked state
function makeSection(
    name: string,
    completed: number,
    total: number,
    blocked = false,
): WorkflowSectionData {
    return {
        name: name as any,
        label: name,
        completedTasks: completed,
        totalTasks: total,
        isBlocked: blocked,
        tasks: [],
    };
}

// All 4 sections the readiness check evaluates (excludes Review & Sign-off)
function allSectionsComplete(overrides: Partial<Record<string, { completed: number; total: number; blocked?: boolean }>> = {}) {
    const defaults: Record<string, { completed: number; total: number; blocked?: boolean }> = {
        'Transaction Review': { completed: 3, total: 3 },
        'Account Reconciliations': { completed: 2, total: 2 },
        'Adjusting Entries': { completed: 2, total: 2 },
        'Pre-Close': { completed: 4, total: 4 },
    };
    const merged = { ...defaults, ...overrides };
    return Object.entries(merged).map(([name, cfg]) =>
        makeSection(name, cfg!.completed, cfg!.total, cfg!.blocked),
    );
}

describe('computeSignOffReadiness', () => {
    it('all sections complete, none blocked → canSignOff: true', () => {
        const result = computeSignOffReadiness(allSectionsComplete());
        expect(result.canSignOff).toBe(true);
        expect(result.passCount).toBe(5);
        expect(result.checklist.every(c => c.done)).toBe(true);
    });

    it('one section incomplete → canSignOff: false, specific item fails', () => {
        const sections = allSectionsComplete({
            'Transaction Review': { completed: 1, total: 3 },
        });
        const result = computeSignOffReadiness(sections);
        expect(result.canSignOff).toBe(false);
        expect(result.passCount).toBe(4);
        // The failing item should be "All transactions categorized"
        const txItem = result.checklist.find(c => c.label === 'All transactions categorized');
        expect(txItem?.done).toBe(false);
    });

    it('questions blocked → "All client questions resolved" fails', () => {
        const sections = allSectionsComplete();
        // Mark one section as blocked
        sections[0].isBlocked = true;
        const result = computeSignOffReadiness(sections);
        expect(result.canSignOff).toBe(false);
        const qItem = result.checklist.find(c => c.label === 'All client questions resolved');
        expect(qItem?.done).toBe(false);
    });

    it('empty section (0 tasks) → treated as complete', () => {
        const sections = allSectionsComplete({
            'Adjusting Entries': { completed: 0, total: 0 }, // 0/0 = done
        });
        const result = computeSignOffReadiness(sections);
        const adjItem = result.checklist.find(c => c.label === 'Adjusting entries posted');
        expect(adjItem?.done).toBe(true);
        expect(result.canSignOff).toBe(true);
    });

    it('missing section → corresponding check fails (defensive)', () => {
        // Only pass 2 out of 4 sections
        const sections = [
            makeSection('Transaction Review', 3, 3),
            makeSection('Account Reconciliations', 2, 2),
        ];
        const result = computeSignOffReadiness(sections);
        expect(result.canSignOff).toBe(false);
        // Adjusting Entries and Pre-Close are missing → those checks fail
        const adjItem = result.checklist.find(c => c.label === 'Adjusting entries posted');
        expect(adjItem?.done).toBe(false);
        const preItem = result.checklist.find(c => c.label === 'Pre-close tasks complete');
        expect(preItem?.done).toBe(false);
    });

    it('all sections incomplete → passCount: 0', () => {
        const sections = allSectionsComplete({
            'Transaction Review': { completed: 0, total: 3 },
            'Account Reconciliations': { completed: 0, total: 2 },
            'Adjusting Entries': { completed: 0, total: 2 },
            'Pre-Close': { completed: 0, total: 4 },
        });
        const result = computeSignOffReadiness(sections);
        expect(result.canSignOff).toBe(false);
        // Only "All client questions resolved" passes (nothing is blocked)
        expect(result.passCount).toBe(1);
    });

    it('returns correct totalChecks count', () => {
        const result = computeSignOffReadiness(allSectionsComplete());
        expect(result.totalChecks).toBe(5);
    });
});
