import { useMemo, useState, useCallback } from 'react';
import { useClientQuestions } from '../../hooks/queries/useClientDetail';
import { useAiQuestions } from '../../hooks/mutations/useTransactionMutations';
import { useCreateQuestion, useResolveQuestion } from '../../hooks/mutations/useCloseMutations';
import { deriveQuestionStatus } from '../../utils/close-utils';
import { useAppDispatch } from '../../store/store';
import { addToast } from '../../store/slices/uiSlice';

interface QuestionsTabProps {
    clientId: string;
    closePeriodId?: string;
    onRefresh?: () => void;
}

interface QuestionItem {
    id: string;
    text: string;
    category: string;
    status: 'pending' | 'answered' | 'overdue';
    sentAt: string;
    assignee: string;
    priority: 'normal' | 'urgent';
    answer?: string;
    vendor?: string;
    amount?: number;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
    pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'schedule' },
    overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', icon: 'warning' },
    answered: { label: 'Answered', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'check_circle' },
};

export default function QuestionsTab({ clientId, closePeriodId, onRefresh }: QuestionsTabProps) {
    const { data: questionsData, isLoading: loading } = useClientQuestions(clientId);
    const aiGenerateMut = useAiQuestions(clientId);
    const createQuestionMut = useCreateQuestion(clientId);
    const resolveQuestionMut = useResolveQuestion(clientId);
    const dispatch = useAppDispatch();

    const [showModal, setShowModal] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newCategory, setNewCategory] = useState('general');

    const questions: QuestionItem[] = useMemo(() => {
        if (!questionsData?.questions) return [];
        return questionsData.questions.map(q => {
            const { status, priority } = deriveQuestionStatus({
                status: q.status,
                respondedAt: q.respondedAt,
                sentAt: q.sentAt,
            });
            return {
                id: q.id,
                text: q.question,
                category: q.category,
                status,
                sentAt: q.sentAt,
                assignee: 'Accountant',
                priority,
                answer: q.response || undefined,
                vendor: q.transactionVendor || undefined,
                amount: q.transactionAmount || undefined,
            };
        });
    }, [questionsData]);

    const handleAiGenerate = useCallback(() => {
        if (!closePeriodId) return;
        aiGenerateMut.mutate(closePeriodId, {
            onSuccess: (data) => {
                if (data.questions === 0) {
                    dispatch(addToast({ type: 'info', message: 'No ambiguous transactions found to generate questions for' }));
                    return;
                }
                onRefresh?.();
            },
        });
    }, [aiGenerateMut, closePeriodId, onRefresh, dispatch]);

    const handleSubmitQuestion = useCallback(() => {
        if (!newQuestion.trim()) return;
        createQuestionMut.mutate(
            { question: newQuestion.trim(), category: newCategory },
            {
                onSuccess: () => {
                    setNewQuestion('');
                    setNewCategory('general');
                    setShowModal(false);
                },
            },
        );
    }, [createQuestionMut, newQuestion, newCategory]);

    const grouped = {
        overdue: questions.filter(q => q.status === 'overdue'),
        pending: questions.filter(q => q.status === 'pending'),
        answered: questions.filter(q => q.status === 'answered'),
    };

    const totalPending = grouped.overdue.length + grouped.pending.length;

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8">
                {/* Summary */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-extrabold text-slate-900">Client Questions</h2>
                        {totalPending > 0 && (
                            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                {totalPending} awaiting response
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {closePeriodId && (
                            <button
                                onClick={handleAiGenerate}
                                disabled={aiGenerateMut.isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-sm font-bold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                <span className={`material-symbols-outlined text-base ${aiGenerateMut.isPending ? 'animate-spin' : ''}`}>
                                    {aiGenerateMut.isPending ? 'progress_activity' : 'auto_awesome'}
                                </span>
                                {aiGenerateMut.isPending ? 'Generating...' : 'AI Generate Questions'}
                            </button>
                        )}
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-base">add</span>
                            New Question
                        </button>
                    </div>
                </div>

                {/* Empty State */}
                {questions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">chat_bubble_outline</span>
                        <h3 className="text-base font-bold text-slate-700 mb-2">No questions yet</h3>
                        <p className="text-sm text-slate-500 max-w-md mb-6">
                            When you need clarification from your client about transactions, receipts, or other items,
                            create a question here.
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-base">add</span>
                            Ask Your First Question
                        </button>
                    </div>
                )}

                {/* Overdue Section */}
                {grouped.overdue.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-red-500 text-base">warning</span>
                            <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider">
                                Overdue ({grouped.overdue.length})
                            </h3>
                        </div>
                        <div className="space-y-3">
                            {grouped.overdue.map(q => (
                                <QuestionCard key={q.id} question={q} resolveMut={resolveQuestionMut} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Pending Section */}
                {grouped.pending.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-amber-500 text-base">schedule</span>
                            <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider">
                                Pending ({grouped.pending.length})
                            </h3>
                        </div>
                        <div className="space-y-3">
                            {grouped.pending.map(q => (
                                <QuestionCard key={q.id} question={q} resolveMut={resolveQuestionMut} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Answered Section */}
                {grouped.answered.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
                            <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">
                                Answered ({grouped.answered.length})
                            </h3>
                        </div>
                        <div className="space-y-3">
                            {grouped.answered.map(q => (
                                <QuestionCard key={q.id} question={q} resolveMut={resolveQuestionMut} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar */}
            <aside className="w-80 border-l border-slate-200 bg-white p-6 overflow-y-auto hidden lg:block">
                <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Close Health</h2>
                </div>

                {grouped.overdue.length > 0 && (
                    <div className="bg-red-50 rounded-xl p-4 border border-red-100 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-red-500 text-base">warning</span>
                            <span className="text-sm font-bold text-red-700">Overdue Questions</span>
                        </div>
                        <p className="text-xs text-red-600">
                            {grouped.overdue.length} question{grouped.overdue.length > 1 ? 's' : ''} overdue. Client response
                            delays may impact close timeline.
                        </p>
                    </div>
                )}

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Response Summary</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Total questions</span>
                            <span className="font-bold text-slate-700">{questions.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Answered</span>
                            <span className="font-bold text-emerald-600">{grouped.answered.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Pending</span>
                            <span className="font-bold text-amber-600">{grouped.pending.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Overdue</span>
                            <span className="font-bold text-red-600">{grouped.overdue.length}</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* New Question Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-extrabold text-slate-900">New Question</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                                <select
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                >
                                    <option value="general">General</option>
                                    <option value="transaction_clarification">Transaction Clarification</option>
                                    <option value="missing_receipt">Missing Receipt</option>
                                    <option value="expense_approval">Expense Approval</option>
                                    <option value="vendor_verification">Vendor Verification</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Question</label>
                                <textarea
                                    value={newQuestion}
                                    onChange={e => setNewQuestion(e.target.value)}
                                    placeholder="Type your question to the client..."
                                    rows={4}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitQuestion}
                                disabled={createQuestionMut.isPending || !newQuestion.trim()}
                                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {createQuestionMut.isPending ? 'Sending...' : 'Send Question'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function QuestionCard({ question, resolveMut }: { question: QuestionItem; resolveMut: ReturnType<typeof useResolveQuestion> }) {
    const config = statusConfig[question.status];
    const daysSinceSent = Math.floor((Date.now() - new Date(question.sentAt).getTime()) / 86400000);
    const [showResolve, setShowResolve] = useState(false);
    const [responseText, setResponseText] = useState('');

    const canResolve = question.status === 'pending' || question.status === 'overdue';
    const isResolving = resolveMut.isPending && resolveMut.variables?.questionId === question.id;

    const handleResolve = () => {
        if (!responseText.trim()) return;
        resolveMut.mutate(
            { questionId: question.id, response: responseText.trim() },
            {
                onSuccess: () => {
                    setShowResolve(false);
                    setResponseText('');
                },
            },
        );
    };

    return (
        <div className={`bg-white rounded-xl border shadow-sm p-5 ${question.status === 'overdue' ? 'border-l-4 border-l-red-400 border-t border-r border-b border-slate-200' : 'border-slate-200'
            }`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
                        {config.label}
                    </span>
                    <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                        {question.category}
                    </span>
                    {question.priority === 'urgent' && (
                        <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">
                            Urgent
                        </span>
                    )}
                </div>
                <span className="text-[11px] text-slate-400">
                    {daysSinceSent === 0 ? 'Today' : daysSinceSent === 1 ? 'Yesterday' : `${daysSinceSent} days ago`}
                </span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed mb-2">{question.text}</p>
            {question.vendor && question.amount && question.amount > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <span className="material-symbols-outlined text-xs">receipt_long</span>
                    <span>{question.vendor} · ${question.amount.toLocaleString()}</span>
                </div>
            )}

            {/* Answered — show the response */}
            {question.answer && (
                <div className="bg-emerald-50 rounded-lg p-3 mt-3 border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-700 mb-1">Client Response:</p>
                    <p className="text-xs text-emerald-600">{question.answer}</p>
                </div>
            )}

            {/* Resolve form for pending/overdue */}
            {canResolve && !showResolve && (
                <button
                    onClick={() => setShowResolve(true)}
                    className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Resolve
                </button>
            )}

            {canResolve && showResolve && (
                <div className="mt-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Client Response</label>
                    <textarea
                        value={responseText}
                        onChange={e => setResponseText(e.target.value)}
                        placeholder="Enter the response received from the client..."
                        rows={3}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none bg-white"
                        autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            onClick={() => { setShowResolve(false); setResponseText(''); }}
                            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleResolve}
                            disabled={isResolving || !responseText.trim()}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-sm">check</span>
                            {isResolving ? 'Resolving...' : 'Save & Resolve'}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-slate-400">Assigned to</span>
                <span className="text-xs font-medium text-slate-600">{question.assignee}</span>
            </div>
        </div>
    );
}
