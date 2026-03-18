import { HealthStatus } from '@doublehq/shared';
import { ClosePeriod, ClientQuestion, TransactionFlag } from '../entities';

/**
 * Health Score Computation Service
 *
 * Implements the weighted algorithm from architecture.md §2.
 * This is PURE business logic — no database, no HTTP, no framework.
 *
 * Score (0-100) = weighted sum of:
 *   - Task Progress (35%)
 *   - Time Pressure (25%)
 *   - Blocking Issues (20%)
 *   - Client Responsiveness (10%)
 *   - Historical Comparison (10%)
 */

export interface HealthScoreInput {
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    dueDate: Date;
    startDate: Date;
    pendingQuestions: ClientQuestion[];
    unresolvedFlags: TransactionFlag[];
    previousCloseTimes: number[]; // days for last N closes
    now?: Date; // injectable for testing
}

export interface HealthScoreResult {
    score: number;
    status: HealthStatus;
    breakdown: {
        taskProgress: number;
        timePressure: number;
        blockingIssues: number;
        clientResponsiveness: number;
        historicalComparison: number;
    };
}

export class HealthScoreService {
    compute(input: HealthScoreInput): HealthScoreResult {
        const now = input.now ?? new Date();

        const taskProgress = this.computeTaskProgress(input);
        const timePressure = this.computeTimePressure(input, now);
        const blockingIssues = this.computeBlockingIssues(input);
        const clientResponsiveness = this.computeClientResponsiveness(input, now);
        const historicalComparison = this.computeHistoricalComparison(input, now);

        // Weighted sum
        const score = Math.round(
            taskProgress * 0.35 +
            timePressure * 0.25 +
            blockingIssues * 0.20 +
            clientResponsiveness * 0.10 +
            historicalComparison * 0.10
        );

        const clampedScore = Math.max(0, Math.min(100, score));
        const status = this.scoreToStatus(clampedScore, input);

        return {
            score: clampedScore,
            status,
            breakdown: {
                taskProgress,
                timePressure,
                blockingIssues,
                clientResponsiveness,
                historicalComparison,
            },
        };
    }

    private computeTaskProgress(input: HealthScoreInput): number {
        if (input.totalTasks === 0) return 0;
        return (input.completedTasks / input.totalTasks) * 100;
    }

    private computeTimePressure(input: HealthScoreInput, now: Date): number {
        const totalDuration = this.daysBetween(input.startDate, input.dueDate);
        const daysRemaining = this.daysBetween(now, input.dueDate);

        if (totalDuration <= 0) return 0;
        if (daysRemaining <= 0) return 0; // Past due

        const timeRemaining = (daysRemaining / totalDuration) * 100;
        const progressPercent = input.totalTasks > 0
            ? (input.completedTasks / input.totalTasks) * 100
            : 0;

        // Expected progress based on time elapsed
        const timeElapsedPct = ((totalDuration - daysRemaining) / totalDuration) * 100;

        // Penalty if behind expected pace
        if (progressPercent < timeElapsedPct) {
            const penaltyMultiplier = progressPercent / Math.max(timeElapsedPct, 1);
            return Math.max(0, timeRemaining * penaltyMultiplier);
        }

        return Math.min(100, timeRemaining);
    }

    private computeBlockingIssues(input: HealthScoreInput): number {
        const pendingCount = input.pendingQuestions.filter(
            q => q.status === 'pending'
        ).length;

        const criticalFlags = input.unresolvedFlags.filter(
            f => f.type === 'uncategorized' || f.type === 'unusual_amount'
        ).length;

        const blockingFactor = pendingCount + criticalFlags;
        return Math.max(0, 100 - blockingFactor * 20);
    }

    private computeClientResponsiveness(input: HealthScoreInput, now: Date): number {
        const pendingQuestions = input.pendingQuestions.filter(q => q.status === 'pending');

        if (pendingQuestions.length === 0) return 100;

        // Average days waiting for response
        const avgWaitDays = pendingQuestions.reduce((sum, q) => {
            return sum + this.daysBetween(q.sentAt, now);
        }, 0) / pendingQuestions.length;

        if (avgWaitDays < 2) return 100;
        if (avgWaitDays < 5) return 70;
        if (avgWaitDays < 10) return 40;
        return 0;
    }

    private computeHistoricalComparison(input: HealthScoreInput, now: Date): number {
        if (input.previousCloseTimes.length === 0) return 70; // No history, assume normal

        const avgPrevious = input.previousCloseTimes.reduce((a, b) => a + b, 0) / input.previousCloseTimes.length;
        const currentDaysElapsed = this.daysBetween(input.startDate, now);
        const currentProgressPct = input.totalTasks > 0
            ? input.completedTasks / input.totalTasks
            : 0;

        // Estimate total days at current pace
        const estimatedTotalDays = currentProgressPct > 0
            ? currentDaysElapsed / currentProgressPct
            : currentDaysElapsed * 3; // Assume slow if no progress

        if (estimatedTotalDays <= avgPrevious * 0.8) return 100; // Faster than average
        if (estimatedTotalDays <= avgPrevious * 1.2) return 70;  // On pace
        return 30; // Slower than average
    }

    private scoreToStatus(score: number, input: HealthScoreInput): HealthStatus {
        if (input.totalTasks > 0 && input.completedTasks === 0 && input.blockedTasks === 0) {
            return HealthStatus.NOT_STARTED;
        }
        if (score >= 75) return HealthStatus.ON_TRACK;
        if (score >= 50) return HealthStatus.AT_RISK;
        return HealthStatus.BEHIND;
    }

    private daysBetween(start: Date, end: Date): number {
        const diffMs = end.getTime() - start.getTime();
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
}
