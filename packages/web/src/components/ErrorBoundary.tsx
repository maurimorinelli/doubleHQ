import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

/**
 * Global error boundary — catches uncaught rendering errors and displays
 * a fallback UI instead of crashing the entire application.
 *
 * React only supports error boundaries as class components (there is no
 * hook equivalent for componentDidCatch / getDerivedStateFromError).
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // In production, send this to an error tracking service (Sentry, Datadog, etc.)
        console.error('Uncaught rendering error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0f172a',
                    color: '#e2e8f0',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    gap: '1rem',
                    padding: '2rem',
                }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something went wrong</h1>
                    <p style={{ color: '#94a3b8', maxWidth: '28rem', textAlign: 'center' }}>
                        An unexpected error occurred. Please refresh the page or contact support if the problem persists.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem 1.5rem',
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                        }}
                    >
                        Refresh Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
