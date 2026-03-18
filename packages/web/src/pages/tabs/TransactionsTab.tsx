import { useClientTransactions } from '../../hooks/queries/useClientDetail';
import {
    useCategorizeTxn,
    useAiCategorize,
    useAiFlag,
    useFlagTxn,
    useUnflagTxn,
    useAddManualTxn,
    useDeleteTxn,
    useUpdateTxnAmount,
} from '../../hooks/mutations/useTransactionMutations';
import { useCreateQuestion } from '../../hooks/mutations/useCloseMutations';
import type { TransactionItem, ReconciliationSummaryByAccount } from '@doublehq/shared';
import { TRANSACTION_CATEGORIES } from '@doublehq/shared';
import { useState, useCallback, useRef, useEffect } from 'react';

interface TransactionsTabProps {
    clientId: string;
    closePeriodId?: string;
    onRefresh?: () => void;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    categorized: { label: 'Categorized', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    uncategorized: { label: 'Uncategorized', bg: 'bg-amber-50', text: 'text-amber-700' },
    flagged: { label: 'Flagged', bg: 'bg-red-50', text: 'text-red-700' },
    pending_client: { label: 'Pending Client', bg: 'bg-blue-50', text: 'text-blue-700' },
};

const CATEGORIES = TRANSACTION_CATEGORIES;

const ACCOUNT_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'checking', label: 'Bank' },
    { key: 'credit_card', label: 'Credit Card' },
];

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
}

/* ─── Inline Editable Amount Cell ──────────────────────── */
function EditableAmount({
    txn,
    clientId,
    disabled,
}: {
    txn: TransactionItem;
    clientId: string;
    disabled: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(txn.amount));
    const updateAmount = useUpdateTxnAmount(clientId);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    const save = () => {
        const parsed = parseFloat(value);
        if (isNaN(parsed) || parsed === txn.amount) {
            setEditing(false);
            setValue(String(txn.amount));
            return;
        }
        updateAmount.mutate({ txnId: txn.id, amount: parsed }, {
            onSettled: () => setEditing(false),
        });
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="number"
                step="0.01"
                value={value}
                onChange={e => setValue(e.target.value)}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') {
                        setValue(String(txn.amount));
                        setEditing(false);
                    }
                }}
                disabled={updateAmount.isPending}
                className="w-24 text-right text-sm font-bold border border-primary rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
            />
        );
    }

    return (
        <button
            onClick={() => {
                if (!disabled) {
                    setValue(String(txn.amount));
                    setEditing(true);
                }
            }}
            className={`tabular-nums font-bold cursor-pointer hover:underline hover:decoration-dashed hover:underline-offset-2 ${txn.type === 'debit' ? 'text-red-600' : 'text-emerald-600'}`}
            title="Click to edit amount"
        >
            {txn.type === 'debit' ? '-' : '+'}{formatCurrency(txn.amount)}
        </button>
    );
}

export default function TransactionsTab({ clientId, closePeriodId, onRefresh }: TransactionsTabProps) {
    const { data, isLoading: loading, error: queryError } = useClientTransactions(clientId);
    const error = queryError?.message ?? null;

    // ─── TanStack Query mutation hooks (toast + cache invalidation built-in) ───
    const categorizeMut = useCategorizeTxn(clientId);
    const aiCategorizeMut = useAiCategorize(clientId);
    const aiFlagMut = useAiFlag(clientId);
    const flagMut = useFlagTxn(clientId);
    const unflagMut = useUnflagTxn(clientId);
    const addTxnMut = useAddManualTxn(clientId);
    const deleteTxnMut = useDeleteTxn(clientId);
    const askClientMut = useCreateQuestion(clientId);

    const [accountFilter, setAccountFilter] = useState('all');
    const [askingTxn, setAskingTxn] = useState<TransactionItem | null>(null);
    const [askQuestion, setAskQuestion] = useState('');

    // ─── Add Transaction form ────────────────────────────
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({
        date: new Date().toISOString().split('T')[0],
        description: '',
        vendor: '',
        amount: '',
        type: 'debit' as 'debit' | 'credit',
        bankAccount: 'checking' as 'checking' | 'credit_card',
    });

    // Determine if any mutation is active for a given txn
    const isTxnBusy = (txnId: string) =>
        (categorizeMut.isPending && categorizeMut.variables?.txnId === txnId) ||
        (flagMut.isPending && flagMut.variables?.txnId === txnId) ||
        (unflagMut.isPending && unflagMut.variables === txnId) ||
        (deleteTxnMut.isPending && deleteTxnMut.variables === txnId);

    const handleCategorize = useCallback((txnId: string, category: string) => {
        categorizeMut.mutate({ txnId, category });
    }, [categorizeMut]);

    const handleAskClient = useCallback(() => {
        if (!askingTxn || !askQuestion.trim()) return;
        askClientMut.mutate(
            { question: askQuestion.trim(), category: `Transaction: ${askingTxn.vendor}` },
            { onSuccess: () => { setAskingTxn(null); setAskQuestion(''); } },
        );
    }, [askClientMut, askingTxn, askQuestion]);

    const handleAiCategorize = useCallback(() => {
        if (!closePeriodId) return;
        aiCategorizeMut.mutate(closePeriodId);
    }, [aiCategorizeMut, closePeriodId]);

    const handleAiFlag = useCallback(() => {
        if (!closePeriodId) return;
        aiFlagMut.mutate(closePeriodId);
    }, [aiFlagMut, closePeriodId]);

    const handleManualFlag = useCallback((txn: TransactionItem) => {
        flagMut.mutate({ txnId: txn.id, reason: `Manual flag: ${txn.vendor} - ${formatCurrency(txn.amount)}` });
    }, [flagMut]);

    const handleUnflag = useCallback((txn: TransactionItem) => {
        unflagMut.mutate(txn.id);
    }, [unflagMut]);

    // ─── Add Manual Transaction ──────────────────────────
    const handleAddTransaction = useCallback(() => {
        if (!closePeriodId || !addForm.date || !addForm.amount) return;
        addTxnMut.mutate({
            closePeriodId,
            date: addForm.date,
            description: addForm.description,
            vendor: addForm.vendor,
            amount: parseFloat(addForm.amount),
            type: addForm.type,
            bankAccount: addForm.bankAccount,
        }, {
            onSuccess: () => {
                setShowAddForm(false);
                setAddForm({
                    date: new Date().toISOString().split('T')[0],
                    description: '',
                    vendor: '',
                    amount: '',
                    type: 'debit',
                    bankAccount: 'checking',
                });
            },
        });
    }, [addTxnMut, closePeriodId, addForm]);

    // ─── Delete Manual Transaction ───────────────────────
    const handleDeleteTransaction = useCallback((txn: TransactionItem) => {
        if (!confirm(`Delete this manual transaction?\n\n${txn.vendor} · ${formatCurrency(txn.amount)}`)) return;
        deleteTxnMut.mutate(txn.id);
    }, [deleteTxnMut]);

    if (loading) {
        return (
            <div className="p-8 space-y-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                ))}
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 text-center">
                    <p className="font-bold">Failed to load transactions</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            </div>
        );
    }

    const { summary, transactions, reconciliationSummary } = data;
    const codingPct = summary.total > 0 ? Math.round((summary.categorized / summary.total) * 100) : 0;
    const filtered = accountFilter === 'all' ? transactions : transactions.filter(t => t.bankAccount === accountFilter);
    const reconSummary: ReconciliationSummaryByAccount[] = reconciliationSummary || [];

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Transaction Table */}
            <div className="flex-1 overflow-y-auto p-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Total', value: summary.total, icon: 'receipt_long', color: 'text-slate-600' },
                        { label: 'Categorized', value: summary.categorized, icon: 'check_circle', color: 'text-emerald-600' },
                        { label: 'Uncategorized', value: summary.uncategorized, icon: 'help', color: 'text-amber-600' },
                        { label: 'Flagged', value: summary.flagged, icon: 'flag', color: 'text-red-600' },
                    ].map((card) => (
                        <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`material-symbols-outlined text-base ${card.color}`}>{card.icon}</span>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.label}</span>
                            </div>
                            <p className="text-2xl font-extrabold text-slate-900">{card.value}</p>
                        </div>
                    ))}
                </div>

                {/* AI Toolbar + Account Filter + Add Transaction */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        {ACCOUNT_FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setAccountFilter(f.key)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${accountFilter === f.key
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Add Transaction button */}
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm"
                            title="Add a manual transaction"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            Add Transaction
                        </button>
                        {/* AI Bulk Action Buttons */}
                        <button
                            onClick={handleAiCategorize}
                            disabled={aiCategorizeMut.isPending || aiFlagMut.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white rounded-lg text-xs font-bold hover:bg-violet-600 transition-colors shadow-sm disabled:opacity-50"
                            title="Use AI to suggest categories for all uncategorized transactions"
                        >
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                            {aiCategorizeMut.isPending ? 'Categorizing...' : 'AI Categorize'}
                        </button>
                        <button
                            onClick={handleAiFlag}
                            disabled={aiCategorizeMut.isPending || aiFlagMut.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50"
                            title="Use AI to identify suspicious transactions"
                        >
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                            {aiFlagMut.isPending ? 'Flagging...' : 'AI Flag'}
                        </button>
                    </div>
                </div>

                {/* Add Transaction Inline Form */}
                {showAddForm && (
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-emerald-600 text-base">add_circle</span>
                            <h3 className="text-sm font-extrabold text-emerald-800">New Manual Transaction</h3>
                        </div>
                        <div className="grid grid-cols-6 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Date</label>
                                <input
                                    type="date"
                                    value={addForm.date}
                                    onChange={e => setAddForm(p => ({ ...p, date: e.target.value }))}
                                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Description</label>
                                <input
                                    type="text"
                                    value={addForm.description}
                                    onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="e.g., Wire transfer"
                                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vendor</label>
                                <input
                                    type="text"
                                    value={addForm.vendor}
                                    onChange={e => setAddForm(p => ({ ...p, vendor: e.target.value }))}
                                    placeholder="e.g., Acme Corp"
                                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={addForm.amount}
                                    onChange={e => setAddForm(p => ({ ...p, amount: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none tabular-nums"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Type</label>
                                <select
                                    value={addForm.type}
                                    onChange={e => setAddForm(p => ({ ...p, type: e.target.value as 'debit' | 'credit' }))}
                                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none"
                                >
                                    <option value="debit">Debit</option>
                                    <option value="credit">Credit</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Account</label>
                                <select
                                    value={addForm.bankAccount}
                                    onChange={e => setAddForm(p => ({ ...p, bankAccount: e.target.value as 'checking' | 'credit_card' }))}
                                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none"
                                >
                                    <option value="checking">Bank</option>
                                    <option value="credit_card">Credit Card</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-3">
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddTransaction}
                                disabled={addTxnMut.isPending || !addForm.date || !addForm.amount}
                                className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                            >
                                {addTxnMut.isPending ? 'Adding...' : 'Add Transaction'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                                <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Date</th>
                                <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Description</th>
                                <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Vendor</th>
                                <th className="text-right px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Amount</th>
                                <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Category</th>
                                <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                                <th className="text-center px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider w-28">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((txn: TransactionItem) => {
                                const status = statusConfig[txn.status] || statusConfig.uncategorized;
                                const isBusy = isTxnBusy(txn.id);
                                return (
                                    <tr key={txn.id} className={`hover:bg-slate-50/60 transition-colors ${isBusy ? 'opacity-50' : ''} ${txn.isManual ? 'bg-emerald-50/30' : ''}`}>
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                            {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3 text-slate-900 font-medium max-w-[180px] truncate">
                                            {txn.description}
                                            {txn.isManual && (
                                                <span className="ml-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 uppercase">Manual</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{txn.vendor}</td>
                                        <td className="px-4 py-3 text-right">
                                            <EditableAmount txn={txn} clientId={clientId} disabled={isBusy} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <select
                                                    disabled={isBusy}
                                                    className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none w-full max-w-[150px]"
                                                    value={txn.finalCategory || ''}
                                                    onChange={(e) => handleCategorize(txn.id, e.target.value)}
                                                >
                                                    <option value="">Select category...</option>
                                                    {CATEGORIES.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                                {txn.status === 'categorized' && (
                                                    <span className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 whitespace-nowrap" title="Confirmed">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>check</span>
                                                    </span>
                                                )}
                                                {txn.status !== 'categorized' && txn.aiSuggestedCategory && (
                                                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 whitespace-nowrap" title={`AI confidence: ${Math.round((txn.aiConfidence || 0) * 100)}%`}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>auto_awesome</span>
                                                        AI
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[11px] font-bold px-2 py-1 rounded ${status.bg} ${status.text}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                {/* Flag / Unflag button */}
                                                {txn.status === 'flagged' ? (
                                                    <button
                                                        onClick={() => handleUnflag(txn)}
                                                        disabled={isBusy}
                                                        className="text-red-500 hover:text-emerald-600 transition-colors p-0.5 rounded hover:bg-emerald-50"
                                                        title="Remove flag"
                                                    >
                                                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleManualFlag(txn)}
                                                        disabled={isBusy}
                                                        className="text-rose-400 hover:text-rose-600 transition-colors p-0.5 rounded hover:bg-rose-50"
                                                        title="Flag for review"
                                                    >
                                                        <span className="material-symbols-outlined text-base">flag</span>
                                                    </button>
                                                )}
                                                {/* Ask Client button */}
                                                <button
                                                    onClick={() => { setAskingTxn(txn); setAskQuestion(`What is this ${formatCurrency(txn.amount)} charge from ${txn.vendor} on ${new Date(txn.date).toLocaleDateString()}?`); }}
                                                    disabled={isBusy}
                                                    className="text-blue-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-blue-50"
                                                    title="Ask Client"
                                                >
                                                    <span className="material-symbols-outlined text-base">chat</span>
                                                </button>
                                                {/* Delete button — only for manual transactions */}
                                                {txn.isManual && (
                                                    <button
                                                        onClick={() => handleDeleteTransaction(txn)}
                                                        disabled={isBusy}
                                                        className="text-slate-400 hover:text-red-600 transition-colors p-0.5 rounded hover:bg-red-50"
                                                        title="Delete manual transaction"
                                                    >
                                                        <span className="material-symbols-outlined text-base">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sidebar: Coding Progress + Reconciliation Balance */}
            <aside className="w-80 border-l border-slate-200 bg-white p-6 overflow-y-auto hidden lg:block">
                <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Coding Progress</h2>
                </div>

                <div className="bg-primary/5 rounded-xl p-5 border border-primary/10 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-slate-700">Session Progress</span>
                        <span className="text-2xl font-extrabold text-primary">{codingPct}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${codingPct}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        {summary.categorized} of {summary.total} transactions categorized
                    </p>
                </div>

                {summary.flagged > 0 && (
                    <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-red-500 text-base">flag</span>
                            <span className="text-sm font-bold text-red-700">Flagged Items</span>
                        </div>
                        <p className="text-xs text-red-600">
                            {summary.flagged} transaction{summary.flagged > 1 ? 's' : ''} flagged for review
                        </p>
                    </div>
                )}

                {summary.pendingClient > 0 && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-blue-500 text-base">person</span>
                            <span className="text-sm font-bold text-blue-700">Pending Client</span>
                        </div>
                        <p className="text-xs text-blue-600">
                            {summary.pendingClient} transaction{summary.pendingClient > 1 ? 's' : ''} awaiting client response
                        </p>
                    </div>
                )}

                {/* ─── Reconciliation Balance ──────────────────── */}
                {reconSummary.length > 0 && (
                    <div className="mt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-indigo-500 text-lg">account_balance</span>
                            <h3 className="text-sm font-extrabold text-slate-900">Reconciliation Balance</h3>
                        </div>
                        <div className="space-y-3">
                            {reconSummary.map((acct: ReconciliationSummaryByAccount) => {
                                const isReconciled = Math.abs(acct.difference) < 0.01;
                                return (
                                    <div
                                        key={acct.bankAccount}
                                        className={`rounded-xl p-4 border transition-colors ${isReconciled
                                            ? 'bg-emerald-50/60 border-emerald-200'
                                            : 'bg-amber-50/60 border-amber-200'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-700">{acct.accountLabel}</span>
                                            {isReconciled ? (
                                                <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check_circle</span>
                                                    Balanced
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>warning</span>
                                                    Unbalanced
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Book Total</span>
                                                <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(acct.bookBalance)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Statement Balance</span>
                                                <span className="font-bold text-slate-900 tabular-nums">
                                                    {acct.bankBalance != null ? formatCurrency(acct.bankBalance) : '—'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between pt-1 border-t border-slate-200/60">
                                                <span className="text-slate-500 font-bold">Difference</span>
                                                <span className={`font-extrabold tabular-nums ${isReconciled ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {isReconciled ? '$0.00' : formatCurrency(acct.difference)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </aside>

            {/* Ask Client Modal */}
            {askingTxn && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setAskingTxn(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-blue-500">chat</span>
                            <h3 className="text-lg font-extrabold text-slate-900">Ask Client</h3>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600">
                            <span className="font-bold">{askingTxn.vendor}</span> · {formatCurrency(askingTxn.amount)} · {new Date(askingTxn.date).toLocaleDateString()}
                        </div>
                        <textarea
                            value={askQuestion}
                            onChange={e => setAskQuestion(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                            rows={3}
                            placeholder="Type your question..."
                        />
                        <div className="flex items-center justify-end gap-3 mt-4">
                            <button onClick={() => setAskingTxn(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleAskClient}
                                disabled={!askQuestion.trim() || askClientMut.isPending}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                                {askClientMut.isPending ? 'Sending...' : 'Send Question'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
