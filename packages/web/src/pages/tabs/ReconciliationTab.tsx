import { useClientReconciliations } from '../../hooks/queries/useClientDetail';
import { useReconcile, useReopenRecon } from '../../hooks/mutations/useCloseMutations';
import type { ReconciliationCard } from '@doublehq/shared';
import { useState, useCallback } from 'react';

interface ReconciliationTabProps {
    clientId: string;
    closePeriodId?: string;
    onRefresh?: () => void;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

const statusColors: Record<string, { bg: string; border: string; badge: string; badgeText: string; icon: string }> = {
    reconciled: {
        bg: 'bg-emerald-50/50',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100',
        badgeText: 'text-emerald-700',
        icon: 'check_circle',
    },
    in_progress: {
        bg: 'bg-amber-50/50',
        border: 'border-amber-200',
        badge: 'bg-amber-100',
        badgeText: 'text-amber-700',
        icon: 'pending',
    },
    not_started: {
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        badge: 'bg-slate-100',
        badgeText: 'text-slate-600',
        icon: 'circle',
    },
};

export default function ReconciliationTab({ clientId, closePeriodId, onRefresh }: ReconciliationTabProps) {
    const { data, isLoading: loading, error: queryError } = useClientReconciliations(clientId);
    const error = queryError?.message ?? null;

    // TanStack Query mutation hooks (toast + cache invalidation built-in)
    const reconcileMut = useReconcile(clientId);
    const reopenMut = useReopenRecon(clientId);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [bankBalanceInput, setBankBalanceInput] = useState('');
    const [notesInput, setNotesInput] = useState('');

    const handleStartEdit = useCallback((recon: ReconciliationCard) => {
        setEditingId(recon.id);
        setBankBalanceInput(recon.bankBalance !== null ? String(recon.bankBalance) : '');
        setNotesInput(recon.notes || '');
    }, []);

    const handleReconcile = useCallback((reconId: string) => {
        const balance = parseFloat(bankBalanceInput);
        if (isNaN(balance)) return;
        reconcileMut.mutate(
            { reconId, bankBalance: balance, notes: notesInput || undefined },
            { onSuccess: () => setEditingId(null) },
        );
    }, [reconcileMut, bankBalanceInput, notesInput]);

    const handleReopen = useCallback((reconId: string) => {
        reopenMut.mutate(reconId);
    }, [reopenMut]);

    if (loading) {
        return (
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 text-center">
                    <p className="font-bold">Failed to load reconciliations</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            </div>
        );
    }

    const { reconciliations } = data;
    const reconciled = reconciliations.filter(r => r.status === 'reconciled').length;
    const total = reconciliations.length;

    return (
        <div className="flex-1 overflow-y-auto p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-extrabold text-slate-900">Account Reconciliation</h2>
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {reconciled}/{total} Reconciled
                    </span>
                </div>
            </div>

            {/* Account Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reconciliations.map((recon: ReconciliationCard) => {
                    const config = statusColors[recon.status] || statusColors.not_started;
                    const isEditing = editingId === recon.id;
                    const isReconciled = recon.status === 'reconciled';
                    const isBusy = reconcileMut.isPending || reopenMut.isPending;

                    // Live difference calculation
                    const inputBalance = isEditing ? parseFloat(bankBalanceInput) : recon.bankBalance;
                    const liveDiff = !isNaN(inputBalance as number) && inputBalance !== null
                        ? recon.bookBalance - (inputBalance as number)
                        : recon.difference;
                    const canReconcile = isEditing && !isNaN(parseFloat(bankBalanceInput)) && Math.abs(liveDiff) < 0.01;

                    return (
                        <div
                            key={recon.id}
                            className={`rounded-xl border-2 p-5 transition-all hover:shadow-md ${isEditing ? 'bg-white border-primary/30 shadow-md ring-2 ring-primary/10' : `${config.bg} ${config.border}`
                                }`}
                        >
                            {/* Account Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-lg ${config.badgeText}`} style={isReconciled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                                        {config.icon}
                                    </span>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">{recon.accountName}</h3>
                                        <p className="text-[11px] text-slate-400">{recon.accountNumber}</p>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${config.badge} ${config.badgeText}`}>
                                    {recon.status.replace('_', ' ')}
                                </span>
                            </div>

                            {/* Balances */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">Book Balance</span>
                                    <span className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(recon.bookBalance)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">Statement Balance</span>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={bankBalanceInput}
                                            onChange={e => setBankBalanceInput(e.target.value)}
                                            className="text-sm font-bold text-slate-900 tabular-nums text-right w-32 border border-slate-300 rounded px-2 py-0.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            placeholder="Enter balance..."
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                                            {recon.bankBalance !== null ? formatCurrency(recon.bankBalance) : '—'}
                                        </span>
                                    )}
                                </div>
                                <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-600">Difference</span>
                                    <span className={`text-sm font-extrabold tabular-nums ${Math.abs(liveDiff) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {formatCurrency(liveDiff)}
                                    </span>
                                </div>
                            </div>

                            {/* Notes */}
                            {isEditing && (
                                <div className="mb-3">
                                    <textarea
                                        value={notesInput}
                                        onChange={e => setNotesInput(e.target.value)}
                                        className="w-full text-xs border border-slate-200 rounded-lg p-2 text-slate-600 focus:border-primary outline-none resize-none"
                                        rows={2}
                                        placeholder="Add notes..."
                                    />
                                </div>
                            )}

                            {/* Action Buttons */}
                            {isReconciled ? (
                                <div className="bg-white/60 rounded-lg p-3 border border-emerald-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1 text-xs text-emerald-600">
                                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                            <span className="font-bold">Reconciled</span>
                                            {recon.reconciledBy && (
                                                <span className="text-emerald-500">by {recon.reconciledBy}</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleReopen(recon.id)}
                                            disabled={isBusy}
                                            className="text-[10px] font-bold text-slate-400 hover:text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-colors"
                                        >
                                            {reopenMut.isPending ? 'Reopening...' : 'Re-open'}
                                        </button>
                                    </div>
                                </div>
                            ) : isEditing ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setEditingId(null)}
                                        className="flex-1 text-center text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg py-2 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleReconcile(recon.id)}
                                        disabled={!canReconcile && Math.abs(liveDiff) >= 0.01 ? false : !canReconcile}
                                        className={`flex-1 text-center text-xs font-bold rounded-lg py-2 transition-colors ${canReconcile
                                            ? 'text-white bg-emerald-500 hover:bg-emerald-600'
                                            : Math.abs(liveDiff) >= 0.01 && !isNaN(parseFloat(bankBalanceInput))
                                                ? 'text-white bg-amber-500 hover:bg-amber-600'
                                                : 'text-slate-400 bg-slate-200 cursor-not-allowed'
                                            }`}
                                    >
                                        {isBusy ? 'Saving...' : canReconcile ? 'Mark Reconciled' : Math.abs(liveDiff) >= 0.01 && !isNaN(parseFloat(bankBalanceInput)) ? 'Save & Continue' : 'Enter Balance'}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleStartEdit(recon)}
                                    className="w-full text-center text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg py-2 transition-colors border border-primary/10"
                                >
                                    Start Reconciliation
                                </button>
                            )}

                            {/* Notes display */}
                            {!isEditing && recon.notes && (
                                <p className="text-[11px] text-slate-400 mt-3 italic">{recon.notes}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
