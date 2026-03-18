import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useIsFetching } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { queryClient } from './lib/queryClient';
import { store } from './store/store';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ClientDetailPage from './pages/ClientDetailPage';
import NewClientPage from './pages/NewClientPage';
import InsightsPage from './pages/InsightsPage';
import TeamPage from './pages/TeamPage';
import LoginPage from './pages/LoginPage';
import ToastContainer from './components/ui/Toast';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#94a3b8',
        fontFamily: 'Inter, sans-serif',
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients/new" element={<NewClientPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/team" element={<TeamPage />} />
      </Route>
    </Routes>
  );
}

function GlobalLoadingBar() {
  const isFetching = useIsFetching();
  if (!isFetching) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-0.5">
      <div className="h-full bg-primary animate-pulse" style={{ width: '100%' }} />
    </div>
  );
}

export default function App() {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <GlobalLoadingBar />
            <AppRoutes />
            <ToastContainer />
          </AuthProvider>
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </QueryClientProvider>
    </ReduxProvider>
  );
}
