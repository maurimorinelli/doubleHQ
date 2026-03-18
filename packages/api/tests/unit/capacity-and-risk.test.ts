/**
 * Team Capacity & Risk Assessment — Unit Tests
 *
 * Tests the pure business logic functions extracted to close-status.service.ts.
 *
 * computeCapacity: determines team member workload status
 *   - ≥5 clients OR ≥2 behind → OVERLOADED
 *   - ≥4 clients OR ≥1 behind → MODERATE
 *   - ≥2 clients → BALANCED
 *   - otherwise → AVAILABLE
 *
 * computeRiskAssessment: determines client close risk level
 *   - All done + signed off → low
 *   - All done + near deadline → high
 *   - Overdue + incomplete → critical/high based on factor count
 *   - Factor count drives risk level, deadline proximity forces minimum "high"
 */
import { CapacityStatus } from '@doublehq/shared';
import { computeCapacity, computeRiskAssessment } from '../../src/domain/services/close-status.service';

describe('computeCapacity — Team Member Workload', () => {

    it('5+ clients → OVERLOADED', () => {
        expect(computeCapacity(5, 0)).toBe(CapacityStatus.OVERLOADED);
        expect(computeCapacity(8, 0)).toBe(CapacityStatus.OVERLOADED);
    });

    it('2+ behind clients → OVERLOADED (even with few total)', () => {
        expect(computeCapacity(3, 2)).toBe(CapacityStatus.OVERLOADED);
    });

    it('4 clients → MODERATE', () => {
        expect(computeCapacity(4, 0)).toBe(CapacityStatus.MODERATE);
    });

    it('1 behind client → MODERATE (even with few total)', () => {
        expect(computeCapacity(2, 1)).toBe(CapacityStatus.MODERATE);
    });

    it('2-3 clients, no behind → BALANCED', () => {
        expect(computeCapacity(2, 0)).toBe(CapacityStatus.BALANCED);
        expect(computeCapacity(3, 0)).toBe(CapacityStatus.BALANCED);
    });

    it('0-1 clients → AVAILABLE', () => {
        expect(computeCapacity(0, 0)).toBe(CapacityStatus.AVAILABLE);
        expect(computeCapacity(1, 0)).toBe(CapacityStatus.AVAILABLE);
    });
});

describe('computeRiskAssessment — Client Close Risk', () => {

    const base = {
        totalTasks: 10,
        completedTasks: 0,
        blockedTasks: 0,
        closePeriodStatus: 'in_progress',
        daysRemaining: 7,
        pendingQuestionsCount: 0,
        oldestQuestionDays: 0,
        unconfirmedAmount: 0,
        unresolvedFlagsCount: 0,
    };

    // ─── All done + signed off ───────────────────────────────────────────────

    it('all tasks complete + signed off → "low" risk', () => {
        const result = computeRiskAssessment({
            ...base,
            completedTasks: 10,
            closePeriodStatus: 'completed',
        });
        expect(result.riskLevel).toBe('low');
        expect(result.factors).toHaveLength(0);
    });

    // ─── All done but NOT signed off ─────────────────────────────────────────

    it('all tasks done, not signed off, plenty of time → "medium"', () => {
        const result = computeRiskAssessment({
            ...base,
            completedTasks: 10,
            daysRemaining: 7,
        });
        expect(result.riskLevel).toBe('medium');
    });

    it('all tasks done, not signed off, within 48h → "high"', () => {
        const result = computeRiskAssessment({
            ...base,
            completedTasks: 10,
            daysRemaining: 1,
        });
        expect(result.riskLevel).toBe('high');
        expect(result.recommendation).toContain('sign off');
    });

    // ─── Overdue and incomplete ──────────────────────────────────────────────

    it('overdue with questions and flags → "critical"', () => {
        const result = computeRiskAssessment({
            ...base,
            completedTasks: 3,
            daysRemaining: -5,
            pendingQuestionsCount: 3,
            oldestQuestionDays: 10,
            unconfirmedAmount: 5000,
            unresolvedFlagsCount: 2,
        });
        expect(result.riskLevel).toBe('critical');
        expect(result.factors.length).toBeGreaterThanOrEqual(4);
        expect(result.recommendation).toContain('overdue');
    });

    // ─── Deadline proximity forces minimum high ──────────────────────────────

    it('within 48h with incomplete tasks → at least "high" risk', () => {
        const result = computeRiskAssessment({
            ...base,
            completedTasks: 5,
            daysRemaining: 1,
        });
        expect(['high', 'critical']).toContain(result.riskLevel);
    });

    // ─── Healthy state ───────────────────────────────────────────────────────

    it('plenty of time, no issues → "low" risk with positive summary', () => {
        const result = computeRiskAssessment({
            ...base,
            completedTasks: 5,
            daysRemaining: 8,
        });
        expect(result.riskLevel).toBe('low');
        expect(result.summary).toContain('On track');
    });

    // ─── Pending questions drive recommendations ─────────────────────────────

    it('pending questions → recommendation mentions follow up', () => {
        const result = computeRiskAssessment({
            ...base,
            completedTasks: 5,
            pendingQuestionsCount: 2,
            oldestQuestionDays: 5,
        });
        expect(result.recommendation).toContain('Follow up');
    });

    it('3+ pending questions near deadline → recommendation to call client', () => {
        const result = computeRiskAssessment({
            ...base,
            completedTasks: 5,
            daysRemaining: 2,
            pendingQuestionsCount: 3,
            oldestQuestionDays: 7,
        });
        expect(result.recommendation).toContain('calling the client');
    });
});
