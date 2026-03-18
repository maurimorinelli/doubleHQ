/**
 * Close Status Service — Unit Tests
 *
 * Pure business logic for:
 *   1. computeHealthStatusOverride — real-time health adjustment based on deadlines
 *   2. computeCapacity — team member workload classification
 *   3. computeRiskAssessment — multi-factor risk analysis with recommendations
 */
import {
    computeHealthStatusOverride,
    computeCapacity,
    computeRiskAssessment,
    HealthStatusOverrideInput,
    RiskAssessmentInput,
} from '../../src/domain/services/close-status.service';
import { HealthStatus, CapacityStatus } from '@doublehq/shared';

// ═══════════════════════════════════════════════════════════════════════════════
// computeHealthStatusOverride
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeHealthStatusOverride', () => {
    const baseInput: HealthStatusOverrideInput = {
        storedHealthStatus: HealthStatus.ON_TRACK,
        closePeriodStatus: 'in_progress',
        daysRemaining: 5,
        totalTasks: 11,
        completedTasks: 6,
    };

    // ─── Signed-off closes should not be overridden ─────────────────────

    it('returns stored status when close is signed off (completed)', () => {
        const result = computeHealthStatusOverride({
            ...baseInput,
            closePeriodStatus: 'closed',
            daysRemaining: -3, // Even if overdue
            completedTasks: 5, // Even if tasks incomplete
        });
        expect(result).toBe(HealthStatus.ON_TRACK);
    });

    // ─── Overdue + incomplete → BEHIND ──────────────────────────────────

    it('overdue with incomplete tasks → BEHIND', () => {
        const result = computeHealthStatusOverride({
            ...baseInput,
            daysRemaining: -2,
            completedTasks: 5,
        });
        expect(result).toBe(HealthStatus.BEHIND);
    });

    // ─── Overdue + all tasks done, was ON_TRACK → AT_RISK ───────────────

    it('overdue with all tasks done but was ON_TRACK → AT_RISK', () => {
        const result = computeHealthStatusOverride({
            ...baseInput,
            daysRemaining: -1,
            completedTasks: 11,
        });
        expect(result).toBe(HealthStatus.AT_RISK);
    });

    // ─── Overdue + all tasks done, was already AT_RISK → stays AT_RISK ──

    it('overdue with all tasks done, was AT_RISK → stays AT_RISK', () => {
        const result = computeHealthStatusOverride({
            ...baseInput,
            storedHealthStatus: HealthStatus.AT_RISK,
            daysRemaining: -1,
            completedTasks: 11,
        });
        expect(result).toBe(HealthStatus.AT_RISK);
    });

    // ─── Within 48 hours, incomplete, was ON_TRACK → AT_RISK ────────────

    it('within 48 hours of deadline, incomplete, ON_TRACK → AT_RISK', () => {
        const result = computeHealthStatusOverride({
            ...baseInput,
            daysRemaining: 1,
            completedTasks: 6,
        });
        expect(result).toBe(HealthStatus.AT_RISK);
    });

    // ─── Within 48 hours but all tasks done → stays ON_TRACK ────────────

    it('within 48 hours but all tasks done → stays ON_TRACK', () => {
        const result = computeHealthStatusOverride({
            ...baseInput,
            daysRemaining: 1,
            completedTasks: 11,
        });
        expect(result).toBe(HealthStatus.ON_TRACK);
    });

    // ─── No override needed ─────────────────────────────────────────────

    it('plenty of time remaining → no override, returns stored status', () => {
        const result = computeHealthStatusOverride({
            ...baseInput,
            daysRemaining: 10,
        });
        expect(result).toBe(HealthStatus.ON_TRACK);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeCapacity
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeCapacity', () => {
    it('0 clients → AVAILABLE', () => {
        expect(computeCapacity(0, 0)).toBe(CapacityStatus.AVAILABLE);
    });

    it('1 client, 0 behind → AVAILABLE', () => {
        expect(computeCapacity(1, 0)).toBe(CapacityStatus.AVAILABLE);
    });

    it('2 clients, 0 behind → BALANCED', () => {
        expect(computeCapacity(2, 0)).toBe(CapacityStatus.BALANCED);
    });

    it('4 clients → MODERATE', () => {
        expect(computeCapacity(4, 0)).toBe(CapacityStatus.MODERATE);
    });

    it('5+ clients → OVERLOADED', () => {
        expect(computeCapacity(5, 0)).toBe(CapacityStatus.OVERLOADED);
    });

    it('any count with 2+ behind → OVERLOADED', () => {
        expect(computeCapacity(2, 2)).toBe(CapacityStatus.OVERLOADED);
    });

    it('any count with 1 behind → at least MODERATE', () => {
        expect(computeCapacity(1, 1)).toBe(CapacityStatus.MODERATE);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeRiskAssessment
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeRiskAssessment', () => {
    const baseInput: RiskAssessmentInput = {
        totalTasks: 11,
        completedTasks: 6,
        blockedTasks: 0,
        closePeriodStatus: 'in_progress',
        daysRemaining: 5,
        pendingQuestionsCount: 0,
        oldestQuestionDays: 0,
        unconfirmedAmount: 0,
        unresolvedFlagsCount: 0,
    };

    // ─── Low risk when everything is fine ────────────────────────────────

    it('all tasks complete and signed off → low risk', () => {
        // Note: computeRiskAssessment uses 'completed' (not ClosePeriodStatus.CLOSED)
        const result = computeRiskAssessment({
            ...baseInput,
            completedTasks: 11,
            closePeriodStatus: 'completed',
        });
        expect(result.riskLevel).toBe('low');
        expect(result.factors).toHaveLength(0);
    });

    // ─── Tasks done but not signed off ──────────────────────────────────

    it('all tasks done but not signed off → medium risk', () => {
        const result = computeRiskAssessment({
            ...baseInput,
            completedTasks: 11,
        });
        expect(result.riskLevel).toBe('medium');
    });

    it('all tasks done, overdue, not signed off → high risk', () => {
        const result = computeRiskAssessment({
            ...baseInput,
            completedTasks: 11,
            daysRemaining: -3,
        });
        expect(result.riskLevel).toBe('high');
    });

    // ─── Multiple risk factors escalate level ───────────────────────────

    it('overdue + pending questions + flags → critical', () => {
        const result = computeRiskAssessment({
            ...baseInput,
            completedTasks: 3,
            daysRemaining: -2,
            pendingQuestionsCount: 3,
            oldestQuestionDays: 7,
            unconfirmedAmount: 5000,
            unresolvedFlagsCount: 2,
        });
        expect(['high', 'critical']).toContain(result.riskLevel);
        expect(result.factors.length).toBeGreaterThanOrEqual(3);
    });

    // ─── Recommendation logic ───────────────────────────────────────────

    it('overdue with pending questions → recommends escalation', () => {
        const result = computeRiskAssessment({
            ...baseInput,
            completedTasks: 3,
            daysRemaining: -1,
            pendingQuestionsCount: 2,
            oldestQuestionDays: 5,
        });
        expect(result.recommendation.toLowerCase()).toContain('overdue');
    });

    it('no issues → recommendation says no action needed', () => {
        const result = computeRiskAssessment({
            ...baseInput,
            daysRemaining: 8,
        });
        expect(result.recommendation.toLowerCase()).toContain('no action');
    });

    // ─── Within 48 hours forces high risk ───────────────────────────────

    it('1 day remaining with limited progress → at least high risk', () => {
        const result = computeRiskAssessment({
            ...baseInput,
            completedTasks: 3,
            daysRemaining: 1,
        });
        expect(['high', 'critical']).toContain(result.riskLevel);
    });
});
