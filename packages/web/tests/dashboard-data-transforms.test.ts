/**
 * Dashboard Data Transform Tests
 *
 * Tests the frontend logic that transforms raw API dashboard data
 * into summary counts, sorting, and filtering for display.
 */
import { describe, it, expect } from 'vitest';

// ─── Types ──────────────────────────────────────────────

interface DashboardClient {
    id: string;
    name: string;
    healthStatus: 'on_track' | 'at_risk' | 'behind' | 'not_started';
    healthScore: number;
    daysRemaining: number;
    isOverdue: boolean;
    preparerId: string;
}

interface DashboardSummary {
    total: number;
    onTrack: number;
    atRisk: number;
    behind: number;
    notStarted: number;
}

// ─── Functions under test ───────────────────────────────

/**
 * Computes summary counts from a list of dashboard clients.
 * Maps health statuses to the four summary buckets.
 */
export function computeSummary(clients: DashboardClient[]): DashboardSummary {
    return clients.reduce(
        (acc, c) => {
            acc.total++;
            switch (c.healthStatus) {
                case 'on_track': acc.onTrack++; break;
                case 'at_risk': acc.atRisk++; break;
                case 'behind': acc.behind++; break;
                case 'not_started': acc.notStarted++; break;
            }
            return acc;
        },
        { total: 0, onTrack: 0, atRisk: 0, behind: 0, notStarted: 0 },
    );
}

/**
 * Sorts clients by the given sort key.
 * Returns a NEW array (doesn't mutate input).
 */
export function sortClients(
    clients: DashboardClient[],
    sortBy: 'health' | 'deadline' | 'name',
): DashboardClient[] {
    const sorted = [...clients];
    switch (sortBy) {
        case 'health':
            sorted.sort((a, b) => a.healthScore - b.healthScore); // worst first
            break;
        case 'deadline':
            sorted.sort((a, b) => a.daysRemaining - b.daysRemaining); // most urgent first
            break;
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
    }
    return sorted;
}

/**
 * Filters clients by status and assignee.
 */
export function filterClients(
    clients: DashboardClient[],
    filters: { status?: string[]; assignee?: string | null },
): DashboardClient[] {
    let result = clients;
    if (filters.status && filters.status.length > 0) {
        result = result.filter(c => filters.status!.includes(c.healthStatus));
    }
    if (filters.assignee) {
        result = result.filter(c => c.preparerId === filters.assignee);
    }
    return result;
}

// ─── Test Data ──────────────────────────────────────────

function makeClient(overrides: Partial<DashboardClient> = {}): DashboardClient {
    return {
        id: 'client_1',
        name: 'Test Client',
        healthStatus: 'on_track',
        healthScore: 85,
        daysRemaining: 5,
        isOverdue: false,
        preparerId: 'tm_001',
        ...overrides,
    };
}

const sampleClients: DashboardClient[] = [
    makeClient({ id: 'c1', name: 'Harbor Coffee Co.', healthStatus: 'on_track', healthScore: 92, daysRemaining: 3, preparerId: 'tm_001' }),
    makeClient({ id: 'c2', name: 'Bright Smile Pediatrics', healthStatus: 'at_risk', healthScore: 42, daysRemaining: 5, preparerId: 'tm_001' }),
    makeClient({ id: 'c3', name: 'Apex Fitness Studio', healthStatus: 'behind', healthScore: 18, daysRemaining: -2, isOverdue: true, preparerId: 'tm_002' }),
    makeClient({ id: 'c4', name: 'Golden Gate Law', healthStatus: 'behind', healthScore: 5, daysRemaining: 1, preparerId: 'tm_003' }),
    makeClient({ id: 'c5', name: 'Verde Landscaping', healthStatus: 'on_track', healthScore: 85, daysRemaining: 7, preparerId: 'tm_002' }),
    makeClient({ id: 'c6', name: 'Zen Yoga', healthStatus: 'not_started', healthScore: 0, daysRemaining: 10, preparerId: 'tm_003' }),
];

// ─── Tests ──────────────────────────────────────────────

describe('computeSummary', () => {
    it('counts each health status correctly', () => {
        const result = computeSummary(sampleClients);
        expect(result.total).toBe(6);
        expect(result.onTrack).toBe(2);
        expect(result.atRisk).toBe(1);
        expect(result.behind).toBe(2);
        expect(result.notStarted).toBe(1);
    });

    it('handles empty array', () => {
        const result = computeSummary([]);
        expect(result.total).toBe(0);
        expect(result.onTrack).toBe(0);
        expect(result.atRisk).toBe(0);
        expect(result.behind).toBe(0);
        expect(result.notStarted).toBe(0);
    });

    it('handles all same status', () => {
        const allBehind = [
            makeClient({ healthStatus: 'behind' }),
            makeClient({ healthStatus: 'behind' }),
        ];
        const result = computeSummary(allBehind);
        expect(result.behind).toBe(2);
        expect(result.onTrack).toBe(0);
    });
});

describe('sortClients', () => {
    it('health sort: worst health score first', () => {
        const sorted = sortClients(sampleClients, 'health');
        expect(sorted[0].name).toBe('Zen Yoga'); // score 0
        expect(sorted[1].name).toBe('Golden Gate Law'); // score 5
        expect(sorted[sorted.length - 1].name).toBe('Harbor Coffee Co.'); // score 92
    });

    it('deadline sort: most urgent first (negative days = overdue)', () => {
        const sorted = sortClients(sampleClients, 'deadline');
        expect(sorted[0].name).toBe('Apex Fitness Studio'); // -2 days
        expect(sorted[1].name).toBe('Golden Gate Law'); // 1 day
    });

    it('name sort: alphabetical', () => {
        const sorted = sortClients(sampleClients, 'name');
        expect(sorted[0].name).toBe('Apex Fitness Studio');
        expect(sorted[sorted.length - 1].name).toBe('Zen Yoga');
    });

    it('does not mutate original array', () => {
        const original = [...sampleClients];
        sortClients(sampleClients, 'health');
        expect(sampleClients.map(c => c.id)).toEqual(original.map(c => c.id));
    });
});

describe('filterClients', () => {
    it('filters by single status', () => {
        const result = filterClients(sampleClients, { status: ['behind'] });
        expect(result.length).toBe(2);
        expect(result.every(c => c.healthStatus === 'behind')).toBe(true);
    });

    it('filters by multiple statuses', () => {
        const result = filterClients(sampleClients, { status: ['behind', 'at_risk'] });
        expect(result.length).toBe(3);
    });

    it('filters by assignee', () => {
        const result = filterClients(sampleClients, { assignee: 'tm_002' });
        expect(result.length).toBe(2);
        expect(result.every(c => c.preparerId === 'tm_002')).toBe(true);
    });

    it('filters by both status and assignee', () => {
        const result = filterClients(sampleClients, {
            status: ['on_track'],
            assignee: 'tm_002',
        });
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Verde Landscaping');
    });

    it('no filters → returns all clients', () => {
        const result = filterClients(sampleClients, {});
        expect(result.length).toBe(sampleClients.length);
    });

    it('impossible filter → returns empty', () => {
        const result = filterClients(sampleClients, {
            status: ['on_track'],
            assignee: 'tm_999',
        });
        expect(result.length).toBe(0);
    });
});
