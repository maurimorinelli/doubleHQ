interface ProgressBarProps {
    value: number;          // 0-100
    label?: string;
    showPercentage?: boolean;
    size?: 'sm' | 'md';
    colorScheme?: 'primary' | 'gradient' | 'health';
    healthScore?: number;   // 0-100, used with colorScheme='health'
}

export default function ProgressBar({
    value,
    label,
    showPercentage = true,
    size = 'md',
    colorScheme = 'primary',
    healthScore,
}: ProgressBarProps) {
    const clamped = Math.min(100, Math.max(0, value));
    const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

    const barColor = (() => {
        if (colorScheme === 'gradient') return 'bg-gradient-to-r from-primary to-indigo-500';
        if (colorScheme === 'health') {
            const score = healthScore ?? clamped;
            if (score >= 80) return 'bg-emerald-500';
            if (score >= 50) return 'bg-amber-500';
            return 'bg-red-500';
        }
        return 'bg-primary';
    })();

    return (
        <div className="w-full">
            {(label || showPercentage) && (
                <div className="flex justify-between items-center mb-1.5">
                    {label && <span className="text-xs font-semibold text-slate-500">{label}</span>}
                    {showPercentage && (
                        <span className="text-xs font-bold text-slate-700">{clamped.toFixed(1)}%</span>
                    )}
                </div>
            )}
            <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${height}`}>
                <div
                    className={`${height} ${barColor} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${clamped}%` }}
                />
            </div>
        </div>
    );
}
