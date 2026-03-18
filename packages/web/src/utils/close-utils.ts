import type { WorkflowSectionData } from '@doublehq/shared';

// ─── Question Status Derivation ────────────────────────
// Extracted from QuestionsTab — determines the display status
// and priority of a question based on response state and age.

export type QuestionDisplayStatus = 'pending' | 'answered' | 'overdue';
export type QuestionPriority = 'normal' | 'urgent';

interface RawQuestion {
    status: string;
    respondedAt: string | null;
    sentAt: string;
}

export interface DerivedQuestionStatus {
    status: QuestionDisplayStatus;
    priority: QuestionPriority;
}

const OVERDUE_THRESHOLD_DAYS = 3;

/**
 * Derives the display status and priority for a client question.
 *
 * Rules:
 * 1. If the client responded (`respondedAt` set) → always "answered"
 * 2. If pending and sent more than 3 days ago → "overdue" + priority "urgent"
 * 3. Otherwise → preserves current status
 *
 * @param question  Raw question data from the API
 * @param now       Current timestamp in ms (default: Date.now()) — injectable for testing
 */
export function deriveQuestionStatus(
    question: RawQuestion,
    now: number = Date.now(),
): DerivedQuestionStatus {
    // Rule 1: A response always wins
    if (question.respondedAt) {
        return { status: 'answered', priority: 'normal' };
    }

    // Rule 2: Pending questions become overdue after 3 days
    if (question.status === 'pending') {
        const daysSinceSent = (now - new Date(question.sentAt).getTime()) / 86_400_000;
        if (daysSinceSent > OVERDUE_THRESHOLD_DAYS) {
            return { status: 'overdue', priority: 'urgent' };
        }
    }

    // Rule 3: Preserve the current status
    const status = (question.status as QuestionDisplayStatus) || 'pending';
    return {
        status,
        priority: status === 'overdue' ? 'urgent' : 'normal',
    };
}

// ─── Sign-off Readiness ────────────────────────────────
// Extracted from ReviewTab — evaluates whether a close period
// meets all prerequisites for sign-off.

export interface ReadinessItem {
    label: string;
    done: boolean;
}

export interface SignOffReadiness {
    checklist: ReadinessItem[];
    passCount: number;
    totalChecks: number;
    canSignOff: boolean;
}

const READINESS_CHECKS: { label: string; sectionName?: string; checkBlocked?: boolean }[] = [
    { label: 'All transactions categorized', sectionName: 'Transaction Review' },
    { label: 'Bank accounts reconciled', sectionName: 'Account Reconciliations' },
    { label: 'Adjusting entries posted', sectionName: 'Adjusting Entries' },
    { label: 'All client questions resolved', checkBlocked: true },
    { label: 'Pre-close tasks complete', sectionName: 'Pre-Close' },
];

/**
 * Computes sign-off readiness based on workflow section progress.
 *
 * Rules:
 * - Section-based checks: `completedTasks === totalTasks` (0/0 counts as done)
 * - Blocked check: passes when NO section is blocked
 * - `canSignOff` requires ALL checks to pass
 */
export function computeSignOffReadiness(sections: WorkflowSectionData[]): SignOffReadiness {
    const anyBlocked = sections.some(s => s.isBlocked);

    const checklist: ReadinessItem[] = READINESS_CHECKS.map(check => {
        if (check.checkBlocked) {
            return { label: check.label, done: !anyBlocked };
        }

        const section = sections.find(s => s.name === check.sectionName);
        const done = section
            ? section.completedTasks === section.totalTasks
            : false; // Missing section → not done (defensive)

        return { label: check.label, done };
    });

    const passCount = checklist.filter(c => c.done).length;

    return {
        checklist,
        passCount,
        totalChecks: checklist.length,
        canSignOff: passCount === checklist.length,
    };
}
