import { Link, useNavigate } from 'react-router-dom';
import { Sprout, LogOut, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Button } from '../common/Button.tsx';

export function WorkspaceNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-sage-200 py-3.5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Brand */}
        <Link to="/workspace" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-forest-900 flex items-center justify-center text-emerald-400 shadow-sm group-hover:scale-105 transition-transform">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-lg tracking-tight text-forest-950">
              AgriSphere<span className="text-forest-600">.AI</span>
            </span>
            <span className="text-[10px] tracking-wider uppercase font-semibold text-sage-600 -mt-1">
              Agronomic Workspace
            </span>
          </div>
        </Link>

        {/* User Badge & Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-forest-50 border border-forest-200 text-xs text-forest-900">
            <UserCheck className="w-3.5 h-3.5 text-forest-600" />
            <span className="font-semibold">{user?.username}</span>
            <span className="text-sage-500">• ID: #{user?.id}</span>
          </div>

          <Link to="/">
            <Button variant="ghost" size="sm">
              Public Portal
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            leftIcon={<LogOut className="w-3.5 h-3.5 text-red-600" />}
            className="border-sage-300 text-charcoal-800 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
          >
            Sign Out
          </Button>
        </div>

      </div>
    </header>
  );
}
