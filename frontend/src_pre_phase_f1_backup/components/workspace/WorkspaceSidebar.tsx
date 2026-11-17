import { Sprout, MessageSquare, Wrench, History, Cpu, LogOut, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export type WorkspaceTab = 'chat' | 'tools' | 'history' | 'overview';

interface WorkspaceSidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  historyCount?: number;
}

export function WorkspaceSidebar({ activeTab, onSelectTab, historyCount }: WorkspaceSidebarProps) {
  const { user, logout } = useAuth();

  const navItems = [
    {
      id: 'chat' as WorkspaceTab,
      label: 'AI Co-Pilot Chat',
      description: 'Conversational assistant',
      icon: MessageSquare,
      badge: 'Live',
    },
    {
      id: 'tools' as WorkspaceTab,
      label: '7 Model Consoles',
      description: 'Direct model inference',
      icon: Wrench,
      badge: '7 Tools',
    },
    {
      id: 'history' as WorkspaceTab,
      label: 'Prediction History',
      description: 'Auditable records',
      icon: History,
      badge: historyCount !== undefined ? `${historyCount}` : undefined,
    },
    {
      id: 'overview' as WorkspaceTab,
      label: 'Model Registry',
      description: 'Integrity & benchmarks',
      icon: Cpu,
      badge: '7/7',
    },
  ];

  return (
    <aside className="w-full lg:w-64 bg-white rounded-3xl border border-sage-200 p-4 shadow-xs flex flex-col justify-between shrink-0">
      <div>
        {/* Brand */}
        <div className="flex items-center gap-3 px-3 py-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-forest-900 flex items-center justify-center text-emerald-400 shadow-sm">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <span className="font-display font-bold text-lg text-forest-950 tracking-tight block">
              AgriSphere<span className="text-forest-600">.AI</span>
            </span>
            <span className="text-[10px] font-semibold text-sage-600 uppercase tracking-wider block">
              AI Workspace
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-forest-800 text-white shadow-xs shadow-forest-900/20'
                    : 'text-charcoal-700 hover:bg-sage-100 hover:text-forest-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-sage-600'}`} />
                  <div className="text-left">
                    <span className="block">{item.label}</span>
                    <span
                      className={`text-[10px] font-normal block ${
                        isActive ? 'text-forest-200' : 'text-sage-500'
                      }`}
                    >
                      {item.description}
                    </span>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                      isActive ? 'bg-forest-900 text-emerald-300' : 'bg-sage-200 text-sage-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Card & Logout */}
      <div className="pt-4 mt-6 border-t border-sage-200">
        <div className="bg-cream-50 rounded-2xl p-3 border border-sage-200 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-charcoal-900 truncate">{user?.username}</p>
              <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active Session
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-charcoal-700 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
