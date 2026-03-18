import { useClientJournalEntries } from '../../hooks/queries/useClientDetail';
import { useCreateJournalEntry, usePostJournalEntry } from '../../hooks/mutations/useCloseMutations';
import type { JournalEntryItem, JournalEntryLineItem } from '@doublehq/shared';
import { useState, useCallback } from 'react';

interface AdjustmentsTabProps {
    clientId: string;
    closePeriodId?: string;
    onRefresh?: () => void;
}

function fmt(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n); }

const typeC: Record<string, { l: string; bg: string; t: string }> = {
    depreciation: { l: 'Depreciation', bg: 'bg-purple-50', t: 'text-purple-700' },
    adjustment: { l: 'Adjustment', bg: 'bg-blue-50', t: 'text-blue-700' },
    recurring: { l: 'Recurring', bg: 'bg-teal-50', t: 'text-teal-700' },
    correction: { l: 'Correction', bg: 'bg-amber-50', t: 'text-amber-700' },
};
const statusC: Record<string, { l: string; bg: string; t: string }> = {
    draft: { l: 'Draft', bg: 'bg-slate-100', t: 'text-slate-600' },
    posted: { l: 'Posted', bg: 'bg-emerald-50', t: 'text-emerald-700' },
    reviewed: { l: 'Reviewed', bg: 'bg-primary/10', t: 'text-primary' },
};

const DEPRECIATION_TEMPLATE = {
    memo: 'Monthly Depreciation — February 2026',
    type: 'depreciation',
    lines: [
        { accountName: 'Depreciation Expense', debit: 833.33, credit: 0, description: 'Monthly depreciation' },
        { accountName: 'Accumulated Depreciation', debit: 0, credit: 833.33, description: 'Monthly depreciation' },
    ],
};

interface NewEntryLine {
    accountName: string;
    debit: string;
    credit: string;
    description: string;
}

export default function AdjustmentsTab({ clientId, closePeriodId, onRefresh }: AdjustmentsTabProps) {
    const { data, isLoading: loading, error: queryError } = useClientJournalEntries(clientId);
    const error = queryError?.message ?? null;

    // TanStack Query mutation hooks (toast + cache invalidation built-in)
    const createEntryMut = useCreateJournalEntry(clientId);
    const postEntryMut = usePostJournalEntry(clientId);

    const [expanded, setExpanded] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [memo, setMemo] = useState('');
    const [entryType, setEntryType] = useState('adjustment');
    const [lines, setLines] = useState<NewEntryLine[]>([
        { accountName: '', debit: '', credit: '', description: '' },
        { accountName: '', debit: '', credit: '', description: '' },
    ]);

    const totalDebits = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

    const handleUseTemplate = useCallback(() => {
        setMemo(DEPRECIATION_TEMPLATE.memo);
        setEntryType(DEPRECIATION_TEMPLATE.type);
        setLines(DEPRECIATION_TEMPLATE.lines.map(l => ({
            accountName: l.accountName,
            debit: l.debit > 0 ? String(l.debit) : '',
            credit: l.credit > 0 ? String(l.credit) : '',
            description: l.description,
        })));
        setShowForm(true);
    }, []);

    const handleAddLine = useCallback(() => {
        setLines(prev => [...prev, { accountName: '', debit: '', credit: '', description: '' }]);
    }, []);

    const handleUpdateLine = useCallback((idx: number, field: keyof NewEntryLine, value: string) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    }, []);

    const handleRemoveLine = useCallback((idx: number) => {
        setLines(prev => prev.filter((_, i) => i !== idx));
    }, []);

    const resetForm = () => {
        setShowForm(false);
        setMemo('');
        setEntryType('adjustment');
        setLines([
            { accountName: '', debit: '', credit: '', description: '' },
            { accountName: '', debit: '', credit: '', description: '' },
        ]);
    };

    const handleCreate = useCallback((postImmediately: boolean) => {
        if (!closePeriodId || !memo.trim()) return;
        const entryData = {
            closePeriodId,
            memo: memo.trim(),
            type: entryType,
            date: new Date().toISOString().split('T')[0],
            lines: lines.filter(l => l.accountName.trim()).map(l => ({
                accountName: l.accountName,
                debit: parseFloat(l.debit) || 0,
                credit: parseFloat(l.credit) || 0,
                description: l.description || undefined,
            })),
        };

        createEntryMut.mutate(entryData, {
            onSuccess: (result) => {
                if (postImmediately && result.entryId) {
                    postEntryMut.mutate(result.entryId);
                }
                resetForm();
            },
        });
    }, [createEntryMut, postEntryMut, closePeriodId, memo, entryType, lines]);

    const handlePostEntry = useCallback((entryId: string) => {
        postEntryMut.mutate(entryId);
    }, [postEntryMut]);

    if (loading) return <div className="p-8 space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />)}</div>;
    if (error || !data) return <div className="p-8"><div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 text-center"><p className="font-bold">Failed to load journal entries</p><p className="text-sm mt-1">{error}</p></div></div>;

    const { entries } = data;
    const posted = entries.filter(e => e.status === 'posted' || e.status === 'reviewed').length;

    return (
        <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-extrabold text-slate-900">Adjusting Entries</h2>
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">{posted}/{entries.length} Posted</span>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-base">add</span>New Entry
                    </button>
                </div>

                {/* New Entry Form */}
                {showForm && (
                    <div className="bg-white rounded-xl border-2 border-primary/20 shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">New Journal Entry</h3>
                            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Memo</label>
                                <input
                                    value={memo}
                                    onChange={e => setMemo(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    placeholder="Entry description..."
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Type</label>
                                <select
                                    value={entryType}
                                    onChange={e => setEntryType(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                >
                                    <option value="adjustment">Adjustment</option>
                                    <option value="depreciation">Depreciation</option>
                                    <option value="recurring">Recurring</option>
                                    <option value="correction">Correction</option>
                                </select>
                            </div>
                        </div>

                        {/* Line Items */}
                        <table className="w-full text-sm mb-4">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left px-2 py-2 text-xs font-bold text-slate-500 uppercase">Account</th>
                                    <th className="text-left px-2 py-2 text-xs font-bold text-slate-500 uppercase">Description</th>
                                    <th className="text-right px-2 py-2 text-xs font-bold text-slate-500 uppercase w-28">Debit</th>
                                    <th className="text-right px-2 py-2 text-xs font-bold text-slate-500 uppercase w-28">Credit</th>
                                    <th className="w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line, idx) => (
                                    <tr key={idx} className="border-b border-slate-100">
                                        <td className="px-2 py-1.5">
                                            <input value={line.accountName} onChange={e => handleUpdateLine(idx, 'accountName', e.target.value)}
                                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:border-primary outline-none" placeholder="Account name..." />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input value={line.description} onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:border-primary outline-none" placeholder="Description..." />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={line.debit} onChange={e => handleUpdateLine(idx, 'debit', e.target.value)}
                                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-right focus:border-primary outline-none" placeholder="0.00" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={line.credit} onChange={e => handleUpdateLine(idx, 'credit', e.target.value)}
                                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-right focus:border-primary outline-none" placeholder="0.00" />
                                        </td>
                                        <td className="px-1">
                                            {lines.length > 2 && (
                                                <button onClick={() => handleRemoveLine(idx)} className="text-slate-300 hover:text-red-500">
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 font-bold">
                                    <td className="px-2 py-2 text-xs text-slate-700" colSpan={2}>
                                        <button onClick={handleAddLine} className="text-primary hover:text-primary/80 text-xs font-bold flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">add</span>Add Line
                                        </button>
                                    </td>
                                    <td className="px-2 py-2 text-right text-xs tabular-nums">{fmt(totalDebits)}</td>
                                    <td className="px-2 py-2 text-right text-xs tabular-nums">{fmt(totalCredits)}</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Balance indicator + Actions */}
                        <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${isBalanced ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                                <span className="material-symbols-outlined text-sm" style={isBalanced ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                                    {isBalanced ? 'check_circle' : 'error'}
                                </span>
                                {isBalanced ? 'Balanced' : `Unbalanced (${fmt(Math.abs(totalDebits - totalCredits))})`}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleCreate(false)}
                                    disabled={createEntryMut.isPending || !memo.trim() || !isBalanced}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {createEntryMut.isPending ? 'Saving...' : 'Save Draft'}
                                </button>
                                <button
                                    onClick={() => handleCreate(true)}
                                    disabled={createEntryMut.isPending || !memo.trim() || !isBalanced}
                                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {createEntryMut.isPending ? 'Posting...' : 'Post Entry'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Existing Entries */}
                <div className="space-y-3">
                    {entries.map((entry: JournalEntryItem) => {
                        const tc = typeC[entry.type] || typeC.adjustment;
                        const sc = statusC[entry.status] || statusC.draft;
                        const isExp = expanded === entry.id;
                        const tD = entry.lines.reduce((s, l) => s + (l.debit || 0), 0);
                        const tC = entry.lines.reduce((s, l) => s + (l.credit || 0), 0);
                        const bal = Math.abs(tD - tC) < 0.01;
                        const isPosting = postEntryMut.isPending;
                        return (
                            <div key={entry.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <button onClick={() => setExpanded(isExp ? null : entry.id)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50/60 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <span className={`material-symbols-outlined text-slate-400 transition-transform ${isExp ? '' : '-rotate-90'}`}>expand_more</span>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-900">{entry.memo}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {entry.createdBy}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${tc.bg} ${tc.t}`}>{tc.l}</span>
                                        <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${sc.bg} ${sc.t}`}>{sc.l}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 ${bal ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                                            <span className="material-symbols-outlined text-xs" style={bal ? { fontVariationSettings: "'FILL' 1" } : undefined}>{bal ? 'check' : 'error'}</span>
                                            {bal ? 'Balanced' : 'Unbalanced'}
                                        </span>
                                        <span className="text-sm font-extrabold text-slate-900 tabular-nums min-w-[80px] text-right">{fmt(tD)}</span>
                                    </div>
                                </button>
                                {isExp && (
                                    <div className="border-t border-slate-100 bg-slate-50/30">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-100">
                                                <th className="text-left px-6 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Account</th>
                                                <th className="text-left px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                                <th className="text-right px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Debit</th>
                                                <th className="text-right px-6 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Credit</th>
                                            </tr></thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {entry.lines.map((line: JournalEntryLineItem) => (
                                                    <tr key={line.id} className="hover:bg-slate-50">
                                                        <td className="px-6 py-2.5 text-slate-900 font-medium">{line.accountName}</td>
                                                        <td className="px-4 py-2.5 text-slate-500">{line.description || '—'}</td>
                                                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{line.debit ? fmt(line.debit) : ''}</td>
                                                        <td className="px-6 py-2.5 text-right tabular-nums font-medium text-slate-900">{line.credit ? fmt(line.credit) : ''}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-50 font-bold">
                                                    <td className="px-6 py-2.5 text-slate-700" colSpan={2}>Total</td>
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{fmt(tD)}</td>
                                                    <td className="px-6 py-2.5 text-right tabular-nums text-slate-900">{fmt(tC)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        {entry.status === 'draft' && bal && (
                                            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handlePostEntry(entry.id); }}
                                                    disabled={isPosting}
                                                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {isPosting ? 'Posting...' : 'Post Entry'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <aside className="w-80 border-l border-slate-200 bg-white p-6 overflow-y-auto hidden lg:block">
                <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">AI Suggestions</h2>
                </div>
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-base">lightbulb</span>
                        <span className="text-sm font-bold text-primary">Monthly Depreciation</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3">Based on the fixed asset schedule, the estimated monthly depreciation is $833.33. Consider posting this entry.</p>
                    <button
                        onClick={handleUseTemplate}
                        className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">add_circle</span>Create Entry
                    </button>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Entry Summary</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs"><span className="text-slate-500">Total entries</span><span className="font-bold text-slate-700">{entries.length}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-500">Posted</span><span className="font-bold text-emerald-600">{posted}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-500">Drafts</span><span className="font-bold text-slate-600">{entries.length - posted}</span></div>
                    </div>
                </div>
            </aside>
        </div>
    );
}
