import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { Sprout } from 'lucide-react';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-900 flex items-center justify-center shadow-glow animate-pulse">
            <Sprout className="w-8 h-8 text-emerald-400" />
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-forest-800 tracking-wide">
          Verifying agricultural session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
