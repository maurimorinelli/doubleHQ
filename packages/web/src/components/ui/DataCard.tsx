interface DataCardProps {
    label: string;
    value: string | number;
    icon?: string;
    iconColor?: string;
    trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
    className?: string;
}

export default function DataCard({ label, value, icon, iconColor = 'text-primary', trend, className = '' }: DataCardProps) {
    const trendColors = {
        up: 'text-emerald-600',
        down: 'text-red-600',
        neutral: 'text-slate-500',
    };

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <div className="flex items-center gap-2">
                {icon && <span className={`material-symbols-outlined text-base ${iconColor}`}>{icon}</span>}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900">{value}</span>
                {trend && (
                    <span className={`text-xs font-bold ${trendColors[trend.direction]}`}>
                        {trend.value}
                    </span>
                )}
            </div>
        </div>
    );
}
