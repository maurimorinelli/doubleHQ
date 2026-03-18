interface EmptyStateProps {
    loading?: boolean;
    error?: string | null;
    children: React.ReactNode;
    loadingText?: string;
}

export default function EmptyState({ loading, error, children, loadingText = 'Loading...' }: EmptyStateProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                    <span className="text-sm font-semibold">{loadingText}</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-500">error</span>
                    <div>
                        <p className="text-sm font-bold text-red-700">Something went wrong</p>
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
