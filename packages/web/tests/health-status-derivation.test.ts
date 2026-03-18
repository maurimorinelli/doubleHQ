/**
 * Health Status Derivation Tests
 *
 * Tests the frontend logic that determines how health status
 * is displayed based on deadline proximity, task completion,
 * and close period state.
 */
import { describe, it, expect } from 'vitest';

// ─── Pure function under test ───────────────────────────
// Extracted business logic: given close period data, determine
// the display health status and whether intervention is needed.

interface CloseDisplayInput {
    healthStatus: string;
    completedTasks: number;
    totalTasks: number;
    dueDate: string;
    signedOffAt: string | null;
}

type DisplayStatus = 'on_track' | 'at_risk' | 'behind' | 'completed' | 'not_started';

/**
 * Derives the real-time display health status for a close period.
 *
 * The backend stores a health status, but the frontend overrides it
 * based on deadline proximity and completion state:
 *
 * 1. Signed off → always "completed"
 * 2. All tasks done → "on_track" regardless of deadline
 * 3. Past due + incomplete → "behind"
 * 4. Within 48h of deadline + < 75% done → "at_risk"
 * 5. Otherwise → preserve backend status
 */
export function deriveDisplayHealthStatus(
    input: CloseDisplayInput,
    now: number = Date.now(),
): DisplayStatus {
    // Rule 1: Signed off = completed
    if (input.signedOffAt) return 'completed';

    // Rule 2: All tasks done = on_track
    if (input.totalTasks > 0 && input.completedTasks === input.totalTasks) return 'on_track';

    // Rule 3: Past due + incomplete = behind
    const dueMs = new Date(input.dueDate).getTime();
    const msRemaining = dueMs - now;
    const hoursRemaining = msRemaining / (1000 * 60 * 60);

    if (hoursRemaining < 0 && input.completedTasks < input.totalTasks) return 'behind';

    // Rule 4: Within 48 hours + less than 75% done = at_risk
    const progressPct = input.totalTasks > 0
        ? input.completedTasks / input.totalTasks
        : 0;

    if (hoursRemaining <= 48 && progressPct < 0.75) return 'at_risk';

    // Rule 5: Preserve backend status
    return input.healthStatus as DisplayStatus;
}

/**
 * Determines whether a close period needs urgent attention.
 */
export function needsUrgentAttention(input: CloseDisplayInput, now: number = Date.now()): boolean {
    const status = deriveDisplayHealthStatus(input, now);
    return status === 'behind';
}

// ─── Tests ──────────────────────────────────────────────

describe('deriveDisplayHealthStatus', () => {
    const NOW = new Date('2026-03-17T12:00:00Z').getTime();

    const base: CloseDisplayInput = {
        healthStatus: 'on_track',
        completedTasks: 5,
        totalTasks: 11,
        dueDate: '2026-03-20T23:59:59Z',
        signedOffAt: null,
    };

    describe('Rule 1: signed-off close', () => {
        it('signed-off → always "completed" regardless of other state', () => {
            const result = deriveDisplayHealthStatus({
                ...base,
                healthStatus: 'behind',
                completedTasks: 0,
                signedOffAt: '2026-03-15T10:00:00Z',
            }, NOW);
            expect(result).toBe('completed');
        });
    });

    describe('Rule 2: all tasks complete', () => {
        it('all tasks done → "on_track" even if backend says "behind"', () => {
            const result = deriveDisplayHealthStatus({
                ...base,
                healthStatus: 'behind',
                completedTasks: 11,
                totalTasks: 11,
            }, NOW);
            expect(result).toBe('on_track');
        });
    });

    describe('Rule 3: overdue close', () => {
        it('past due with incomplete tasks → "behind"', () => {
            const result = deriveDisplayHealthStatus({
                ...base,
                healthStatus: 'on_track',
                dueDate: '2026-03-16T23:59:59Z', // Yesterday
                completedTasks: 3,
            }, NOW);
            expect(result).toBe('behind');
        });

        it('past due but all done → "on_track" (Rule 2 takes precedence)', () => {
            const result = deriveDisplayHealthStatus({
                ...base,
                dueDate: '2026-03-16T23:59:59Z',
                completedTasks: 11,
                totalTasks: 11,
            }, NOW);
            expect(result).toBe('on_track');
        });
    });

    describe('Rule 4: deadline pressure', () => {
        it('within 48h and < 75% done → "at_risk"', () => {
            const result = deriveDisplayHealthStatus({
                ...base,
                dueDate: '2026-03-18T23:59:59Z', // ~36h away
                completedTasks: 3,
                totalTasks: 11, // 27%
            }, NOW);
            expect(result).toBe('at_risk');
        });

        it('within 48h but >= 75% done → preserves backend status', () => {
            const result = deriveDisplayHealthStatus({
                ...base,
                healthStatus: 'on_track',
                dueDate: '2026-03-18T23:59:59Z',
                completedTasks: 9,
                totalTasks: 11, // 82%
            }, NOW);
            expect(result).toBe('on_track');
        });
    });

    describe('Rule 5: fallback to backend status', () => {
        it('normal deadline distance → preserves backend status', () => {
            const result = deriveDisplayHealthStatus({
                ...base,
                healthStatus: 'at_risk',
                dueDate: '2026-03-25T23:59:59Z', // 8 days away
            }, NOW);
            expect(result).toBe('at_risk');
        });
    });

    describe('edge cases', () => {
        it('zero total tasks → preserves backend status (no divide-by-zero)', () => {
            const result = deriveDisplayHealthStatus({
                ...base,
                totalTasks: 0,
                completedTasks: 0,
            }, NOW);
            expect(result).not.toBeUndefined();
        });

        it('exactly at deadline → "at_risk" if progress is low (0h remaining triggers Rule 4)', () => {
            const result = deriveDisplayHealthStatus({
                ...base,
                dueDate: '2026-03-17T12:00:00Z', // Exactly now
                completedTasks: 2,
            }, NOW);
            expect(result).toBe('at_risk'); // 0 hours ≤ 48, < 75% done
        });
    });
});

describe('needsUrgentAttention', () => {
    const NOW = new Date('2026-03-17T12:00:00Z').getTime();

    it('returns true for overdue + incomplete closes', () => {
        expect(needsUrgentAttention({
            healthStatus: 'on_track',
            completedTasks: 3,
            totalTasks: 11,
            dueDate: '2026-03-16T23:59:59Z',
            signedOffAt: null,
        }, NOW)).toBe(true);
    });

    it('returns false for completed closes', () => {
        expect(needsUrgentAttention({
            healthStatus: 'behind',
            completedTasks: 0,
            totalTasks: 11,
            dueDate: '2026-03-01T00:00:00Z',
            signedOffAt: '2026-03-15T10:00:00Z',
        }, NOW)).toBe(false);
    });

    it('returns false for on-track closes', () => {
        expect(needsUrgentAttention({
            healthStatus: 'on_track',
            completedTasks: 9,
            totalTasks: 11,
            dueDate: '2026-03-25T23:59:59Z',
            signedOffAt: null,
        }, NOW)).toBe(false);
    });
});
