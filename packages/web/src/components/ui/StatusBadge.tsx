import type { HealthStatus } from '@doublehq/shared';

const config: Record<string, { label: string; bg: string; text: string; dot: string; icon: string }> = {
    on_track: { label: 'On Track', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: 'check_circle' },
    at_risk: { label: 'At Risk', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', icon: 'warning' },
    behind: { label: 'Behind', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', icon: 'error' },
    completed: { label: 'Completed', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', icon: 'verified' },
    not_started: { label: 'Not Started', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', icon: 'pending' },
};

interface StatusBadgeProps {
    status: HealthStatus | string;
    size?: 'sm' | 'md';
    showIcon?: boolean;
}

export default function StatusBadge({ status, size = 'md', showIcon = true }: StatusBadgeProps) {
    const c = config[status] || config.not_started;
    const sizeClasses = size === 'sm'
        ? 'px-2 py-0.5 text-[10px] gap-1'
        : 'px-3 py-1 text-xs gap-1.5';

    return (
        <span className={`inline-flex items-center font-bold rounded-full ${c.bg} ${c.text} ${sizeClasses}`}>
            {showIcon && <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />}
            {c.label}
        </span>
    );
}
