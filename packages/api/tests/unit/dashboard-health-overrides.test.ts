/**
 * Dashboard Health Status Overrides — Unit Tests
 *
 * Tests the REAL computeHealthStatusOverride function imported from
 * close-status.service.ts — no code duplication.
 *
 * Rules:
 *   - Overdue + tasks incomplete → BEHIND (regardless of stored status)
 *   - Overdue + all tasks done but not signed off → AT_RISK
 *   - Within 48 hours + tasks incomplete + stored ON_TRACK → AT_RISK
 *   - Signed off (closed) → no override, use stored status
 */
import { HealthStatus } from '@doublehq/shared';
import { computeHealthStatusOverride } from '../../src/domain/services/close-status.service';

describe('Dashboard Health Status Overrides', () => {

    // ─── Overdue scenarios ───────────────────────────────────────────────────

    it('overdue with incomplete tasks → always BEHIND, even if stored as ON_TRACK', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.ON_TRACK,
            closePeriodStatus: 'in_progress',
            daysRemaining: -3,
            totalTasks: 10,
            completedTasks: 7,
        })).toBe(HealthStatus.BEHIND);
    });

    it('overdue with incomplete tasks → BEHIND even if stored as AT_RISK', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.AT_RISK,
            closePeriodStatus: 'in_progress',
            daysRemaining: -1,
            totalTasks: 5,
            completedTasks: 3,
        })).toBe(HealthStatus.BEHIND);
    });

    it('overdue but ALL tasks done → downgrades ON_TRACK to AT_RISK', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.ON_TRACK,
            closePeriodStatus: 'in_progress',
            daysRemaining: -1,
            totalTasks: 10,
            completedTasks: 10,
        })).toBe(HealthStatus.AT_RISK);
    });

    it('overdue, all tasks done, already AT_RISK → stays AT_RISK', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.AT_RISK,
            closePeriodStatus: 'in_progress',
            daysRemaining: -2,
            totalTasks: 8,
            completedTasks: 8,
        })).toBe(HealthStatus.AT_RISK);
    });

    // ─── Near-deadline (within 48 hours) ────────────────────────────────────

    it('within 48h, tasks incomplete, stored ON_TRACK → AT_RISK', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.ON_TRACK,
            closePeriodStatus: 'in_progress',
            daysRemaining: 1,
            totalTasks: 10,
            completedTasks: 8,
        })).toBe(HealthStatus.AT_RISK);
    });

    it('within 48h, all tasks done → stays ON_TRACK', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.ON_TRACK,
            closePeriodStatus: 'in_progress',
            daysRemaining: 1,
            totalTasks: 10,
            completedTasks: 10,
        })).toBe(HealthStatus.ON_TRACK);
    });

    it('within 48h, stored AT_RISK → stays AT_RISK (no upgrade)', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.AT_RISK,
            closePeriodStatus: 'in_progress',
            daysRemaining: 2,
            totalTasks: 10,
            completedTasks: 5,
        })).toBe(HealthStatus.AT_RISK);
    });

    // ─── Signed-off → no override ────────────────────────────────────────────

    it('signed off (closed) → stored status preserved even if overdue', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.ON_TRACK,
            closePeriodStatus: 'closed',
            daysRemaining: -10,
            totalTasks: 10,
            completedTasks: 10,
        })).toBe(HealthStatus.ON_TRACK);
    });

    // ─── Plenty of time → no override ────────────────────────────────────────

    it('plenty of time remaining → stored status preserved', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.ON_TRACK,
            closePeriodStatus: 'in_progress',
            daysRemaining: 7,
            totalTasks: 10,
            completedTasks: 3,
        })).toBe(HealthStatus.ON_TRACK);
    });

    // ─── Edge case: zero tasks ────────────────────────────────────────────────

    it('zero total tasks, overdue → BEHIND (not treated as "all done")', () => {
        expect(computeHealthStatusOverride({
            storedHealthStatus: HealthStatus.ON_TRACK,
            closePeriodStatus: 'in_progress',
            daysRemaining: -1,
            totalTasks: 0,
            completedTasks: 0,
        })).toBe(HealthStatus.BEHIND);
    });
});
