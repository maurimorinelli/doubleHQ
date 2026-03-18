/**
 * Close Status Service — Pure Business Logic
 *
 * Extracted from use cases so it can be:
 *   1. Imported and tested directly (no mocking or copying needed)
 *   2. Reused across dashboard, client detail, and other views
 *
 * These functions are pure — no side effects, no database, no I/O.
 */
import { HealthStatus, ClosePeriodStatus, CapacityStatus } from '@doublehq/shared';

// ─── Health Status Override ──────────────────────────────────────────────────
// The stored health status becomes stale as time passes. This function
// recalculates it using deadline proximity and task completion.

export interface HealthStatusOverrideInput {
    storedHealthStatus: HealthStatus;
    closePeriodStatus: string;
    daysRemaining: number;
    totalTasks: number;
    completedTasks: number;
}

export function computeHealthStatusOverride(input: HealthStatusOverrideInput): HealthStatus {
    const { storedHealthStatus, closePeriodStatus, daysRemaining, totalTasks, completedTasks } = input;

    let healthStatus = storedHealthStatus;
    const isSignedOff = closePeriodStatus === ClosePeriodStatus.CLOSED;
    const isAllTasksDone = totalTasks > 0 && completedTasks >= totalTasks;

    if (!isSignedOff) {
        if (daysRemaining < 0) {
            // Overdue and not closed
            if (!isAllTasksDone) {
                healthStatus = HealthStatus.BEHIND;
            } else if (healthStatus === HealthStatus.ON_TRACK) {
                healthStatus = HealthStatus.AT_RISK;
            }
        } else if (daysRemaining <= 2) {
            // Within 48 hours of deadline
            if (!isAllTasksDone && healthStatus === HealthStatus.ON_TRACK) {
                healthStatus = HealthStatus.AT_RISK;
            }
        }
    }

    return healthStatus;
}

// ─── Team Capacity ───────────────────────────────────────────────────────────
// Determines workload status for a team member based on client count and
// number of behind clients.

export function computeCapacity(clientCount: number, behindCount: number): CapacityStatus {
    if (clientCount >= 5 || behindCount >= 2) return CapacityStatus.OVERLOADED;
    if (clientCount >= 4 || behindCount >= 1) return CapacityStatus.MODERATE;
    if (clientCount >= 2) return CapacityStatus.BALANCED;
    return CapacityStatus.AVAILABLE;
}

// ─── Risk Assessment ─────────────────────────────────────────────────────────
// Computes risk level and recommendations for a client's close period.

export interface RiskAssessmentInput {
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    closePeriodStatus: string;
    daysRemaining: number;
    pendingQuestionsCount: number;
    oldestQuestionDays: number;
    unconfirmedAmount: number;
    unresolvedFlagsCount: number;
}

export interface RiskAssessmentResult {
    riskLevel: 'low' | 'medium' | 'medium_high' | 'high' | 'critical';
    summary: string;
    factors: string[];
    recommendation: string;
}

export function computeRiskAssessment(input: RiskAssessmentInput): RiskAssessmentResult {
    const {
        totalTasks, completedTasks, blockedTasks, closePeriodStatus,
        daysRemaining, pendingQuestionsCount, oldestQuestionDays,
        unconfirmedAmount, unresolvedFlagsCount,
    } = input;

    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const isComplete = totalTasks > 0 && completedTasks >= totalTasks;

    // If all tasks are complete AND signed off — truly low risk
    if (isComplete && closePeriodStatus === 'completed') {
        return {
            riskLevel: 'low',
            summary: 'All tasks complete and close is signed off.',
            factors: [],
            recommendation: 'No action needed — this close is finalized.',
        };
    }

    // Tasks are done but close is NOT signed off
    if (isComplete) {
        const overdueDays = daysRemaining < 0 ? Math.abs(daysRemaining) : 0;
        const isNearOrPastDeadline = daysRemaining <= 2;
        return {
            riskLevel: isNearOrPastDeadline ? 'high' : 'medium',
            summary: overdueDays > 0
                ? `All tasks complete but close is ${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue — sign off immediately.`
                : daysRemaining <= 2
                    ? `All tasks complete. Deadline is ${daysRemaining === 0 ? 'today' : `in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`} — sign off now.`
                    : 'All tasks complete. Review and sign off to finalize.',
            factors: overdueDays > 0
                ? [`${overdueDays} day${overdueDays > 1 ? 's' : ''} past deadline without sign-off`]
                : [],
            recommendation: 'Review the close summary and sign off immediately.',
        };
    }

    const factors: string[] = [];

    // Overdue and incomplete
    if (daysRemaining < 0) {
        factors.push(`${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) > 1 ? 's' : ''} past the deadline with ${progressPct}% complete`);
    }

    if (pendingQuestionsCount > 0) {
        factors.push(`${pendingQuestionsCount} pending client question${pendingQuestionsCount > 1 ? 's' : ''} (oldest: ${oldestQuestionDays} days)`);
        if (unconfirmedAmount > 0) factors.push(`$${unconfirmedAmount.toLocaleString()} in unconfirmed transactions`);
    }

    if (unresolvedFlagsCount > 0) {
        factors.push(`${unresolvedFlagsCount} unresolved transaction flag${unresolvedFlagsCount > 1 ? 's' : ''}`);
    }

    if (blockedTasks > 0) {
        factors.push(`${blockedTasks} blocked task${blockedTasks > 1 ? 's' : ''} preventing progress`);
    }

    if (daysRemaining >= 0 && daysRemaining <= 2) {
        factors.push(`Only ${progressPct}% done with ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`);
    }

    let riskLevel: RiskAssessmentResult['riskLevel'] = 'low';
    if (factors.length >= 4) riskLevel = 'critical';
    else if (factors.length >= 3) riskLevel = 'high';
    else if (factors.length >= 2) riskLevel = 'medium_high';
    else if (factors.length >= 1) riskLevel = 'medium';

    // Overdue or within 48 hours — force at least 'high'
    if (daysRemaining <= 2) {
        if (riskLevel === 'low' || riskLevel === 'medium' || riskLevel === 'medium_high') {
            riskLevel = 'high';
        }
    }

    let summary: string;
    if (riskLevel === 'critical' || riskLevel === 'high') {
        summary = `This client has ${factors.length} risk factors requiring immediate attention.`;
    } else if (factors.length > 0) {
        summary = `This client has ${factors.length} risk factor${factors.length > 1 ? 's' : ''} to address.`;
    } else {
        summary = daysRemaining > 5
            ? `On track — ${daysRemaining} days until deadline with ${progressPct}% complete.`
            : `Progressing well — ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining.`;
    }

    const recommendation = computeRecommendation(factors, pendingQuestionsCount, daysRemaining, progressPct);

    return { riskLevel, summary, factors, recommendation };
}

function computeRecommendation(factors: string[], pendingQuestionsCount: number, daysRemaining: number, progressPct: number): string {
    if (daysRemaining < 0 && progressPct < 100) {
        if (pendingQuestionsCount > 0) {
            return 'This close is overdue with pending client questions. Escalate to unblock and complete remaining tasks.';
        }
        return `This close is ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) > 1 ? 's' : ''} overdue. Focus on completing remaining tasks or request a deadline extension.`;
    }
    if (pendingQuestionsCount >= 3 && daysRemaining <= 3) {
        return 'Consider calling the client directly — email reminders are not getting responses and the deadline is imminent.';
    }
    if (pendingQuestionsCount > 0) {
        return 'Follow up with the client on pending questions to unblock reconciliation.';
    }
    if (daysRemaining >= 0 && daysRemaining <= 2 && progressPct < 80) {
        return `Deadline is in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Prioritize remaining tasks to close on time.`;
    }
    if (factors.length > 0) {
        return 'Review the risk factors above and address the most critical ones first.';
    }
    return 'No action needed — continue at the current pace.';
}
