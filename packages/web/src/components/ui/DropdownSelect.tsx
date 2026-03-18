interface Option {
    value: string;
    label: string;
    badge?: string;
}

interface DropdownSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    icon?: string;
    size?: 'sm' | 'md';
    className?: string;
    disabled?: boolean;
}

export default function DropdownSelect({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    icon,
    size = 'md',
    className = '',
    disabled = false,
}: DropdownSelectProps) {
    const sizeClasses = size === 'sm'
        ? 'text-xs py-1 px-2'
        : 'text-sm py-2 px-3';

    return (
        <div className={`relative ${className}`}>
            {icon && (
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">
                    {icon}
                </span>
            )}
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                className={`
                    w-full font-semibold border border-slate-200 rounded-lg bg-white
                    focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                    disabled:opacity-50 disabled:cursor-not-allowed
                    appearance-none cursor-pointer
                    ${icon ? 'pl-8' : ''}
                    ${sizeClasses}
                `}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}{opt.badge ? ` (${opt.badge})` : ''}
                    </option>
                ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">
                expand_more
            </span>
        </div>
    );
}
