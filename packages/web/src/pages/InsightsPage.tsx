import { useState } from 'react';
import { useInsights } from '../hooks/queries/useTeam';
import { useRefreshInsights } from '../hooks/mutations/useCloseMutations';
import EmptyState from '../components/ui/EmptyState';
import type { InsightCategory } from '@doublehq/shared';

const categoryStyles: Record<InsightCategory, { border: string; label: string; labelColor: string; actionBg: string }> = {
    urgent: { border: 'border-l-red-500', label: 'Urgent Attention Required', labelColor: 'text-red-500', actionBg: 'bg-primary' },
    at_risk: { border: 'border-l-amber-500', label: 'At Risk', labelColor: 'text-amber-500', actionBg: 'bg-amber-500' },
    insight: { border: 'border-l-primary', label: 'Workload Optimization', labelColor: 'text-primary', actionBg: 'bg-primary' },
    win: { border: 'border-l-emerald-500', label: 'Efficiency Win', labelColor: 'text-emerald-500', actionBg: 'bg-emerald-500' },
};

const tabs = [
    { key: 'all' as const, label: 'All' },
    { key: 'urgent' as const, label: 'Urgent', dot: 'bg-red-500' },
    { key: 'at_risk' as const, label: 'At Risk', dot: 'bg-amber-500' },
    { key: 'insight' as const, label: 'Insights', dot: 'bg-primary' },
    { key: 'win' as const, label: 'Wins', dot: 'bg-emerald-500' },
];

export default function InsightsPage() {
    const [activeTab, setActiveTab] = useState<string>('all');
    const { data, isLoading, error } = useInsights();
    const refresh = useRefreshInsights();

    const filtered = data?.insights.filter(
        (i) => activeTab === 'all' || i.category === activeTab
    ) ?? [];

    return (
        <>
            {/* Header */}
            <header className="bg-white border-b border-slate-200 p-8">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-primary text-3xl filled">auto_awesome</span>
                            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">AI Insights</h1>
                        </div>
                        <p className="text-slate-500 text-lg">AI-generated recommendations based on your firm's current close status</p>
                        {data && (
                            <p className="text-xs font-medium text-slate-400 mt-2 uppercase tracking-wider">
                                Last updated: {new Date(data.lastUpdated).toLocaleString()}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => refresh.mutate()}
                        disabled={refresh.isPending}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
                    >
                        <span className={`material-symbols-outlined text-sm ${refresh.isPending ? 'animate-spin' : ''}`}>refresh</span>
                        <span>{refresh.isPending ? 'Refreshing...' : 'Refresh Insights'}</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="max-w-5xl mx-auto mt-8 border-b border-slate-100 flex gap-8 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`pb-4 border-b-2 font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === tab.key
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            {tab.dot && <span className={`w-2 h-2 rounded-full ${tab.dot}`} />}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Content */}
            <section className="flex-1 overflow-y-auto p-8 bg-background-light">
                <EmptyState loading={isLoading} error={error?.message}>
                    <div className="max-w-5xl mx-auto flex flex-col gap-6">
                        {filtered.map((insight) => {
                            const style = categoryStyles[insight.category];
                            return (
                                <div
                                    key={insight.id}
                                    className={`bg-white rounded-xl shadow-sm border-l-4 ${style.border} overflow-hidden flex flex-col md:flex-row`}
                                >
                                    <div className="p-6 flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`${style.labelColor} text-xs font-black uppercase tracking-widest`}>
                                                {style.label}
                                            </span>
                                            {insight.category === 'win' && (
                                                <span className="material-symbols-outlined text-emerald-500 text-sm">trending_up</span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">{insight.title}</h3>
                                        <p className="text-slate-600">{insight.description}</p>
                                        {insight.affectedClient && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                                                    {insight.affectedClient.name}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`p-6 flex flex-col justify-center gap-3 border-l border-slate-100 md:w-64 ${insight.category === 'win' ? 'bg-emerald-50' : 'bg-slate-50'
                                        }`}>
                                        {insight.category === 'win' ? (
                                            <div className="text-center">
                                                <p className="text-emerald-600 font-bold text-xs mb-1">IMPROVEMENT</p>
                                                <p className="text-3xl font-black text-emerald-600">
                                                    {insight.metrics?.improvement || '-'}
                                                </p>
                                            </div>
                                        ) : (
                                            <button className={`w-full py-2 px-4 ${style.actionBg} text-white rounded-lg font-bold text-sm hover:opacity-90 transition-colors`}>
                                                {insight.recommendedAction}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && !isLoading && (
                            <div className="text-center py-16 text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2">info</span>
                                <p className="font-medium">No insights in this category</p>
                            </div>
                        )}
                    </div>
                </EmptyState>
            </section>
        </>
    );
}
