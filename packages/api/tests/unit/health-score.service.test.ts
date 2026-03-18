/**
 * HealthScoreService — Unit Tests
 *
 * The health score is the weighted algorithm at the heart of the dashboard.
 * It answers: "How is this close going?" for every client.
 *
 * Score (0-100) = weighted sum of:
 *   - Task Progress     (35%)
 *   - Time Pressure     (25%)
 *   - Blocking Issues   (20%)
 *   - Client Responsiveness (10%)
 *   - Historical Comparison  (10%)
 */
import { HealthScoreService, HealthScoreInput } from '../../src/domain/services/health-score.service';
import { HealthStatus } from '@doublehq/shared';

describe('HealthScoreService', () => {
    const service = new HealthScoreService();

    const baseInput: HealthScoreInput = {
        totalTasks: 10,
        completedTasks: 0,
        blockedTasks: 0,
        startDate: new Date('2026-03-01'),
        dueDate: new Date('2026-03-10'),
        pendingQuestions: [],
        unresolvedFlags: [],
        previousCloseTimes: [],
        now: new Date('2026-03-05'), // Mid-way through the close window
    };

    // ─── Score is always between 0 and 100 ───────────────────────────────────

    it('score is always clamped between 0 and 100', () => {
        // Worst case scenario: past due, no progress, many blocking issues
        const result = service.compute({
            ...baseInput,
            now: new Date('2026-03-20'), // 10 days past due
            pendingQuestions: Array.from({ length: 10 }, (_, i) => ({
                id: `q-${i}`, closePeriodId: 'cp', clientId: 'cl',
                question: 'test?', category: 'general',
                transactionAmount: 0, transactionDate: new Date(), transactionVendor: '',
                sentAt: new Date('2026-03-01'), respondedAt: null, response: null,
                status: 'pending', remindersSent: 0, lastReminderAt: null,
            })),
            unresolvedFlags: Array.from({ length: 10 }, (_, i) => ({
                id: `f-${i}`, clientId: 'cl', closePeriodId: 'cp',
                type: 'uncategorized', description: '', amount: 0,
                transactionDate: new Date(), vendor: '', accountCoded: null,
                suggestedAccount: null, isResolved: false, resolvedAt: null,
                resolvedBy: null, flaggedAt: new Date(),
            })),
        });

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
    });

    // ─── ON_TRACK when close is healthy ──────────────────────────────────────

    it('all tasks complete, no blockers → ON_TRACK with high score', () => {
        const result = service.compute({
            ...baseInput,
            completedTasks: 10,
        });

        expect(result.score).toBeGreaterThanOrEqual(75);
        expect(result.status).toBe(HealthStatus.ON_TRACK);
    });

    // ─── BEHIND when close is severely behind ────────────────────────────────

    it('past due with no tasks complete → low score, still NOT_STARTED (zero progress takes precedence)', () => {
        const result = service.compute({
            ...baseInput,
            now: new Date('2026-03-15'), // 5 days past due
        });

        expect(result.score).toBeLessThan(50);
        // Business rule: 0 completed + 0 blocked = NOT_STARTED, even past due
        expect(result.status).toBe(HealthStatus.NOT_STARTED);
    });

    // ─── BEHIND when some progress is made but severely behind ───────────────

    it('past due with minimal progress → low score, BEHIND', () => {
        const result = service.compute({
            ...baseInput,
            completedTasks: 1, // Some progress (so it's not NOT_STARTED)
            now: new Date('2026-03-15'), // 5 days past due
        });

        expect(result.score).toBeLessThan(50);
        expect(result.status).toBe(HealthStatus.BEHIND);
    });

    // ─── NOT_STARTED when no work has begun ──────────────────────────────────

    it('zero completed tasks, zero blocks → NOT_STARTED', () => {
        const result = service.compute({
            ...baseInput,
            now: new Date('2026-03-02'), // Early in the window
        });

        expect(result.status).toBe(HealthStatus.NOT_STARTED);
    });

    // ─── Stale client questions reduce responsiveness ────────────────────────

    it('pending questions older than 5 days reduce responsiveness score', () => {
        const freshResult = service.compute({
            ...baseInput,
            completedTasks: 5, // Some progress so it's not NOT_STARTED
        });

        const staleResult = service.compute({
            ...baseInput,
            completedTasks: 5,
            pendingQuestions: [
                {
                    id: 'q1', closePeriodId: 'cp', clientId: 'cl',
                    question: 'Where is the receipt?', category: 'missing_receipt',
                    transactionAmount: 500, transactionDate: new Date(), transactionVendor: 'Office Depot',
                    sentAt: new Date('2026-02-25'), // 8 days ago (now is March 5)
                    respondedAt: null, response: null, status: 'pending',
                    remindersSent: 1, lastReminderAt: null,
                },
            ],
        });

        expect(staleResult.score).toBeLessThan(freshResult.score);
        expect(staleResult.breakdown.clientResponsiveness).toBeLessThan(freshResult.breakdown.clientResponsiveness);
    });

    // ─── Unresolved flags penalize blocking score ────────────────────────────

    it('uncategorized and unusual_amount flags penalize blocking score', () => {
        const cleanResult = service.compute({
            ...baseInput,
            completedTasks: 5,
        });

        const flaggedResult = service.compute({
            ...baseInput,
            completedTasks: 5,
            unresolvedFlags: [
                {
                    id: 'f1', clientId: 'cl', closePeriodId: 'cp',
                    type: 'uncategorized', description: 'Missing category',
                    amount: 1000, transactionDate: new Date(), vendor: 'Unknown',
                    accountCoded: null, suggestedAccount: null,
                    isResolved: false, resolvedAt: null, resolvedBy: null,
                    flaggedAt: new Date(),
                },
                {
                    id: 'f2', clientId: 'cl', closePeriodId: 'cp',
                    type: 'unusual_amount', description: 'Amount 10x average',
                    amount: 50000, transactionDate: new Date(), vendor: 'Vendor X',
                    accountCoded: null, suggestedAccount: null,
                    isResolved: false, resolvedAt: null, resolvedBy: null,
                    flaggedAt: new Date(),
                },
            ],
        });

        expect(flaggedResult.score).toBeLessThan(cleanResult.score);
        expect(flaggedResult.breakdown.blockingIssues).toBeLessThan(cleanResult.breakdown.blockingIssues);
    });

    // ─── Historical comparison — slower than average ─────────────────────────

    it('slower pace than historical average reduces historical score', () => {
        const fastResult = service.compute({
            ...baseInput,
            completedTasks: 8, // 80% done mid-way
            previousCloseTimes: [10, 12, 8],
        });

        const slowResult = service.compute({
            ...baseInput,
            completedTasks: 1, // 10% done mid-way
            previousCloseTimes: [5, 4, 6], // Used to close fast
        });

        expect(slowResult.breakdown.historicalComparison).toBeLessThan(fastResult.breakdown.historicalComparison);
    });

    // ─── Edge case: zero total tasks ─────────────────────────────────────────

    it('zero total tasks → task progress returns 0, not NaN', () => {
        const result = service.compute({
            ...baseInput,
            totalTasks: 0,
            completedTasks: 0,
        });

        expect(result.breakdown.taskProgress).toBe(0);
        expect(result.score).not.toBeNaN();
    });

    // ─── Breakdown components are individually coherent ──────────────────────

    it('score breakdown components are all between 0 and 100', () => {
        const result = service.compute({
            ...baseInput,
            completedTasks: 7,
        });

        const { breakdown } = result;
        for (const [key, value] of Object.entries(breakdown)) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(100);
        }
    });
});
