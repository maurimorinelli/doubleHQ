import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/store';
import { toggleStatusFilter, setSort, setPeriod } from '../store/slices/dashboardFiltersSlice';
import { useDashboard } from '../hooks/queries/useDashboard';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import type { HealthStatus } from '@doublehq/shared';

const summaryCards = [
    { key: 'onTrack' as const, statusKey: 'on_track' as HealthStatus, label: 'On Track', icon: 'check_circle', iconColor: 'text-emerald-500' },
    { key: 'atRisk' as const, statusKey: 'at_risk' as HealthStatus, label: 'At Risk', icon: 'warning', iconColor: 'text-amber-500' },
    { key: 'behind' as const, statusKey: 'behind' as HealthStatus, label: 'Behind', icon: 'error', iconColor: 'text-rose-500' },
    { key: 'notStarted' as const, statusKey: 'not_started' as HealthStatus, label: 'Not Started', icon: 'pending', iconColor: 'text-slate-400' },
];

export default function DashboardPage() {
    const dispatch = useAppDispatch();
    const filters = useAppSelector(s => s.dashboardFilters);
    const { data, isLoading, error } = useDashboard();

    // Generate last 6 months for the period dropdown
    const periodOptions = (() => {
        const options: { value: string; label: string }[] = [{ value: 'all', label: 'All periods' }];
        const now = new Date();
        for (let i = 0; i < 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            options.push({ value, label });
        }
        return options;
    })();

    return (
        <>
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold tracking-tight">Close Copilot</h1>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                        AI Powered
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                            search
                        </span>
                        <input
                            className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-primary"
                            placeholder="Search clients or tasks..."
                            type="text"
                        />
                    </div>
                    <button className="size-10 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
                <EmptyState loading={isLoading} error={error?.message}>
                    {data && (
                        <>
                            {/* Summary Stats — click to filter via Redux */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                {summaryCards.map((card) => (
                                    <button
                                        key={card.key}
                                        onClick={() => dispatch(toggleStatusFilter(card.statusKey))}
                                        className={`bg-white p-5 rounded-xl border shadow-sm text-left transition-all ${filters.statusFilters.includes(card.statusKey)
                                            ? 'border-primary ring-2 ring-primary/20'
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-medium text-slate-500">{card.label}</span>
                                            <span className={`material-symbols-outlined ${card.iconColor}`}>{card.icon}</span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-bold">{data.summary[card.key]}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Section Header with Redux-persisted filters */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-lg font-bold">Client Health Cards</h2>
                                    <p className="text-sm text-slate-500">
                                        {data.summary.total} Active Closes · {!filters.period ? 'All periods' : data.summary.period}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={filters.period || 'all'}
                                        onChange={(e) => dispatch(setPeriod(e.target.value === 'all' ? null : e.target.value))}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                    >
                                        {periodOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={filters.sort}
                                        onChange={(e) => dispatch(setSort(e.target.value))}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                    >
                                        <option value="overdue">Most overdue first</option>
                                        <option value="health_asc">Lowest health first</option>
                                        <option value="name">Alphabetical</option>
                                    </select>
                                </div>
                            </div>

                            {/* Client Grid — uses StatusBadge and ProgressBar components */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {data.clients.map((client) => (
                                    <Link
                                        key={client.id}
                                        to={`/clients/${client.id}`}
                                        className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                                    >
                                        <div className="p-5 border-b border-slate-100">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-slate-900">{client.name}</h3>
                                                    <p className="text-xs text-slate-500">{client.industry}</p>
                                                </div>
                                                <StatusBadge status={client.healthStatus} size="sm" />
                                            </div>
                                            <ProgressBar
                                                value={client.progress}
                                                label="Close Progress"
                                                size="sm"
                                                colorScheme="health"
                                                healthScore={client.healthScore}
                                            />
                                        </div>
                                        <div className="px-5 py-4 flex items-center justify-between bg-slate-50/50">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Next Due</span>
                                                <span className={`text-xs font-semibold ${client.isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                                                    {client.isOverdue
                                                        ? `${Math.abs(client.daysRemaining)} days overdue`
                                                        : `${client.daysRemaining} days remaining`}
                                                </span>
                                            </div>
                                            <div className="flex -space-x-2">
                                                <div className="size-6 rounded-full bg-primary/20 border border-white flex items-center justify-center text-[10px] font-bold text-primary">
                                                    {client.preparer.initials}
                                                </div>
                                                <div className="size-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                    {client.reviewer.initials}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </EmptyState>
            </div>
        </>
    );
}
