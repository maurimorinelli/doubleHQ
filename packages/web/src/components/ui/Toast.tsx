import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { removeToast } from '../../store/slices/uiSlice';

export default function ToastContainer() {
    const toasts = useAppSelector(s => s.ui.toasts);
    const dispatch = useAppDispatch();

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            {toasts.map(toast => (
                <ToastItem
                    key={toast.id}
                    id={toast.id}
                    type={toast.type}
                    message={toast.message}
                    onDismiss={() => dispatch(removeToast(toast.id))}
                />
            ))}
        </div>
    );
}

function ToastItem({ id, type, message, onDismiss }: {
    id: string; type: 'success' | 'error' | 'info'; message: string; onDismiss: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 4000);
        return () => clearTimeout(timer);
    }, [id, onDismiss]);

    const styles = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-red-600 text-white',
        info: 'bg-slate-800 text-white',
    };

    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
    };

    return (
        <div className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold animate-slide-up ${styles[type]}`}>
            <span className="material-symbols-outlined text-lg">{icons[type]}</span>
            <span>{message}</span>
            <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-base">close</span>
            </button>
        </div>
    );
}
