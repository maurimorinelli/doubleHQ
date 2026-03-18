import type { ReactNode } from 'react';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    icon?: string;
    children: ReactNode;
    maxWidth?: string;
}

export default function Modal({ open, onClose, title, icon, children, maxWidth = 'max-w-md' }: ModalProps) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in"
            onClick={onClose}
        >
            <div
                className={`bg-white rounded-2xl shadow-2xl p-8 w-full ${maxWidth}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-6">
                    {icon && (
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">{icon}</span>
                        </div>
                    )}
                    <h2 className="text-xl font-bold text-slate-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
