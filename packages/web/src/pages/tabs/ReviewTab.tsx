import type { WorkflowSectionData, RiskFactor, ClosePeriodInfo } from '@doublehq/shared';
import { useSignOff } from '../../hooks/mutations/useCloseMutations';
import { computeSignOffReadiness } from '../../utils/close-utils';
import { useState } from 'react';

interface ReviewTabProps {
    sections: WorkflowSectionData[];
    riskAssessment: RiskFactor;
    closePeriod: ClosePeriodInfo;
    clientId: string;
    onRefresh?: () => void;
}

export default function ReviewTab({ sections, riskAssessment, closePeriod, clientId, onRefresh }: ReviewTabProps) {
    const totalTasks = sections.reduce((s, sec) => s + sec.totalTasks, 0);
    const completedTasks = sections.reduce((s, sec) => s + sec.completedTasks, 0);
    const allComplete = totalTasks === completedTasks;

    const [reviewNotes, setReviewNotes] = useState('');
    const [locked, setLocked] = useState(false);
    const [signedOffAt, setSignedOffAt] = useState<string | null>(null);

    const signOffMut = useSignOff(clientId);

    const { checklist, passCount } = computeSignOffReadiness(sections);

    const handleSignOff = () => {
        signOffMut.mutate(reviewNotes, {
            onSuccess: (result) => {
                if (result.locked) {
                    setLocked(true);
                    setSignedOffAt(result.signedOffAt);
                    onRefresh?.();
                }
            },
        });
    };

    // ─── Locked Confirmation ──────────────────────────────
    if (locked) {
        return (
            <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
                <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-2xl p-10 max-w-lg text-center">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-4xl text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Close Period Locked</h2>
                    <p className="text-sm text-slate-500 mb-6">{closePeriod.period} has been signed off and locked.</p>

                    <div className="bg-emerald-50 rounded-xl p-5 mb-6 text-left space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-600 uppercase">Period</span>
                            <span className="text-sm font-extrabold text-emerald-800">{closePeriod.period}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-600 uppercase">Tasks Completed</span>
                            <span className="text-sm font-extrabold text-emerald-800">{totalTasks}/{totalTasks}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-600 uppercase">Signed Off At</span>
                            <span className="text-sm font-medium text-emerald-700">
                                {signedOffAt ? new Date(signedOffAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Just now'}
                            </span>
                        </div>
                        {reviewNotes && (
                            <div className="border-t border-emerald-200 pt-3">
                                <span className="text-xs font-bold text-emerald-600 uppercase block mb-1">Review Notes</span>
                                <p className="text-sm text-emerald-700">{reviewNotes}</p>
                            </div>
                        )}
                    </div>

                    <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-md">
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                        Go to Next Client
                    </a>
                </div>
            </div>
        );
    }

    // ─── Review & Sign-off View ───────────────────────────
    return (
        <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-extrabold text-slate-900">Review & Sign-off</h2>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${allComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {allComplete ? 'Ready for Sign-off' : `${completedTasks}/${totalTasks} Tasks Complete`}
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Close Summary */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-primary">summarize</span>
                            Close Summary
                        </h3>
                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Period</span>
                                    <span className="text-sm font-extrabold text-slate-900">{closePeriod.period}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Due Date</span>
                                    <span className="text-sm font-medium text-slate-700">
                                        {new Date(closePeriod.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Days Remaining</span>
                                    <span className={`text-sm font-bold ${closePeriod.daysRemaining > 0 ? 'text-slate-700' : 'text-red-600'}`}>
                                        {closePeriod.daysRemaining > 0 ? closePeriod.daysRemaining : `${Math.abs(closePeriod.daysRemaining)} overdue`}
                                    </span>
                                </div>
                            </div>

                            {/* Section Progress */}
                            <div className="space-y-3">
                                {sections.map((section, idx) => {
                                    const pct = section.totalTasks > 0 ? Math.round((section.completedTasks / section.totalTasks) * 100) : 0;
                                    return (
                                        <div key={section.name}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-medium text-slate-600">{idx + 1}. {section.label}</span>
                                                <span className="text-xs font-bold text-slate-900">{section.completedTasks}/{section.totalTasks}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Readiness Checklist */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-primary">checklist</span>
                            Close Readiness ({passCount}/{checklist.length})
                        </h3>
                        <div className="space-y-3">
                            {checklist.map((item, i) => (
                                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${item.done ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                                    <span className={`material-symbols-outlined text-lg ${item.done ? 'text-emerald-500' : 'text-slate-300'}`} style={item.done ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                                        {item.done ? 'check_circle' : 'circle'}
                                    </span>
                                    <span className={`text-sm font-medium ${item.done ? 'text-emerald-700' : 'text-slate-600'}`}>
                                        {item.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Review Notes */}
                <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-primary">rate_review</span>
                        Review Notes
                    </h3>
                    <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-4 text-sm text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                        rows={4}
                        placeholder="Add review notes before signing off... (optional)"
                    />
                </div>

                {/* Sign-off Button */}
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={handleSignOff}
                        disabled={!allComplete || signOffMut.isPending}
                        className={`flex items-center gap-3 px-8 py-3 rounded-xl text-base font-extrabold shadow-lg transition-all ${allComplete && !signOffMut.isPending
                            ? 'bg-primary text-white hover:bg-primary/90 hover:shadow-xl cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <span className="material-symbols-outlined text-xl">{signOffMut.isPending ? 'progress_activity' : 'lock'}</span>
                        {signOffMut.isPending ? 'Signing Off...' : allComplete ? 'Sign Off & Lock Period' : 'Complete All Tasks to Sign Off'}
                    </button>
                </div>
            </div>

            {/* Sidebar: AI Review */}
            <aside className="w-80 border-l border-slate-200 bg-white p-6 overflow-y-auto hidden lg:block">
                <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">AI Review Notes</h2>
                </div>
                <div className={`rounded-xl p-4 border mb-4 ${riskAssessment.riskLevel === 'low' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                    <p className={`text-sm font-bold mb-2 ${riskAssessment.riskLevel === 'low' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {riskAssessment.summary}
                    </p>
                    {riskAssessment.factors.map((f, i) => (
                        <p key={i} className={`text-xs mb-1 ${riskAssessment.riskLevel === 'low' ? 'text-emerald-600' : 'text-amber-600'}`}>• {f}</p>
                    ))}
                </div>
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <p className="text-xs font-bold text-primary mb-1">Recommendation</p>
                    <p className="text-xs text-slate-600">{riskAssessment.recommendation}</p>
                </div>
            </aside>
        </div>
    );
}
