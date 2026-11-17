import { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  CloudRain,
  FlaskConical,
  Sprout,
  Eye,
  TrendingUp,
  PackageCheck,
  Coins,
  Sparkles,
  Activity,
  History,
  Cpu,
  LogOut,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Trash2,
  ChevronDown,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { BrandLogo } from '../common/BrandLogo.tsx';
import type { ChatSession } from '../../types/index.ts';

export type WorkspaceTab =
  | 'dashboard'
  | 'smart_center'
  | 'chat'
  | 'tools'
  | 'calendar'
  | 'farm_twin'
  | 'soil_health'
  | 'crop_monitoring'
  | 'harvest'
  | 'history'
  | 'overview';

interface WorkspaceSidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab, modelId?: string) => void;
  selectedModelId?: string;
  historyCount?: number;
  chatSessions?: ChatSession[];
  activeChatSessionId?: number | null;
  onSelectChatSession?: (session: ChatSession) => void;
  onCreateNewChat?: () => void;
  onDeleteChatSession?: (sessionId: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
  farmLocation?: string | null;
}

export function WorkspaceSidebar({
  activeTab,
  onSelectTab,
  selectedModelId,
  historyCount,
  chatSessions = [],
  activeChatSessionId,
  onSelectChatSession,
  onCreateNewChat,
  onDeleteChatSession,
  isCollapsed = false,
  onToggleCollapse,
  isMobileDrawer = false,
  onCloseMobileDrawer,
  farmLocation,
}: WorkspaceSidebarProps) {
  const { user, isDemo, logout } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const [userMode, setUserMode] = useState<'farmer' | 'expert'>('farmer');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const handleNavClick = (tab: WorkspaceTab, modelId?: string) => {
    onSelectTab(tab, modelId);
    if (isMobileDrawer && onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  const handleNewChatClick = () => {
    if (onCreateNewChat) {
      onCreateNewChat();
    } else {
      onSelectTab('dashboard');
    }
    if (isMobileDrawer && onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  const handleSessionClick = (session: ChatSession) => {
    if (onSelectChatSession) {
      onSelectChatSession(session);
    }
    onSelectTab('chat');
    if (isMobileDrawer && onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  const confirmDeleteSession = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm(t('এই চ্যাট সেশনটি মুছে ফেলতে চান?', 'Delete this consultation session?'))) {
      if (onDeleteChatSession) {
        onDeleteChatSession(id);
      }
    }
  };

  // Main Navigation items matching 01_reference_desktop.png & 02_dashboard_reference.png
  const mainNavItems = [
    {
      id: 'dashboard' as WorkspaceTab,
      label: lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard',
      icon: LayoutDashboard,
      isActive: activeTab === 'dashboard',
    },
    {
      id: 'calendar' as WorkspaceTab,
      label: lang === 'bn' ? 'কৃষি ক্যালেন্ডার' : 'Krishi Calendar',
      icon: Calendar,
      isActive: activeTab === 'calendar',
    },
    {
      id: 'tools' as WorkspaceTab,
      modelId: 'flood_susceptibility',
      label: lang === 'bn' ? 'আবহাওয়া ও ঝুঁকি' : 'Weather & Risk',
      icon: CloudRain,
      isActive: activeTab === 'tools' && selectedModelId === 'flood_susceptibility',
    },
  ];

  // Intelligence Modules matching 01_reference_desktop.png
  const intelligenceModules = [
    {
      id: 'soil_health' as WorkspaceTab,
      label: lang === 'bn' ? 'মাটি বিশ্লেষণ' : 'Soil Intelligence',
      icon: FlaskConical,
      isActive: activeTab === 'soil_health',
    },
    {
      id: 'tools' as WorkspaceTab,
      modelId: 'crop_recommendation',
      label: lang === 'bn' ? 'ফসল উপদেষ্টা' : 'Crop Advisor',
      icon: Sprout,
      isActive: activeTab === 'tools' && selectedModelId === 'crop_recommendation',
    },
    {
      id: 'crop_monitoring' as WorkspaceTab,
      label: lang === 'bn' ? 'ফসল স্বাস্থ্য' : 'Crop Health',
      icon: Eye,
      isActive: activeTab === 'crop_monitoring',
    },
    {
      id: 'tools' as WorkspaceTab,
      modelId: 'regional_crop_yield',
      label: lang === 'bn' ? 'ফলন পূর্বাভাস' : 'Yield Prediction',
      icon: TrendingUp,
      isActive: activeTab === 'tools' && selectedModelId === 'regional_crop_yield',
    },
    {
      id: 'harvest' as WorkspaceTab,
      label: lang === 'bn' ? 'ফসল ও গুদাম' : 'Harvest & Storage',
      icon: PackageCheck,
      isActive: activeTab === 'harvest',
    },
    {
      id: 'tools' as WorkspaceTab,
      modelId: 'tomato_price',
      label: lang === 'bn' ? 'কৃষি বাজার' : 'KrishiMarket',
      icon: Coins,
      isActive: activeTab === 'tools' && (selectedModelId === 'tomato_price' || selectedModelId === 'boro_rice_price'),
    },
  ];

  // Additional 360° modules to preserve all platform functionality
  const advancedModules = [
    {
      id: 'smart_center' as WorkspaceTab,
      label: lang === 'bn' ? 'স্মার্ট কৃষি কেন্দ্র' : 'Smart Farm Center',
      icon: Sparkles,
      badge: '360°',
      isActive: activeTab === 'smart_center',
    },
    {
      id: 'farm_twin' as WorkspaceTab,
      label: lang === 'bn' ? 'ফার্ম ডিজিটাল টুইন' : 'Farm Digital Twin',
      icon: Activity,
      badge: 'Twin',
      isActive: activeTab === 'farm_twin',
    },
    {
      id: 'history' as WorkspaceTab,
      label: lang === 'bn' ? 'প্রেডিকশন ইতিহাস' : 'Prediction History',
      icon: History,
      badge: historyCount ? `${historyCount}` : undefined,
      isActive: activeTab === 'history',
    },
    {
      id: 'tools' as WorkspaceTab,
      modelId: 'tomato_disease_v3',
      label: lang === 'bn' ? '৭টি AI মডেল কনসোল' : '7 AI Models Console',
      icon: Wrench,
      badge: '7 Models',
      isActive: activeTab === 'tools' && !['flood_susceptibility', 'crop_recommendation', 'regional_crop_yield', 'tomato_price', 'boro_rice_price'].includes(selectedModelId || ''),
    },
    {
      id: 'overview' as WorkspaceTab,
      label: lang === 'bn' ? 'মডেল রেজিস্ট্রি ও অডিট' : 'Model Registry',
      icon: Cpu,
      badge: 'Audit',
      isActive: activeTab === 'overview',
    },
  ];

  const userLocationText = farmLocation?.trim()
    ? farmLocation
    : lang === 'bn'
      ? 'খামার নির্বাচন করুন'
      : 'Select your farm';

  return (
    <aside
      className={`krishi-glass-panel text-[#f8fbf7] flex flex-col justify-between transition-all duration-300 ${
        isMobileDrawer
          ? 'w-full h-full p-4 overflow-y-auto'
          : isCollapsed
          ? 'w-20 p-2 shrink-0'
          : 'w-[272px] p-3.5 shrink-0 h-screen sticky top-0 overflow-y-auto krishi-scrollbar'
      }`}
    >
      <div className="flex flex-col gap-3">
        
        {/* 1. Header: Brand Logo & Wordmark + Collapse Button */}
        <div className="flex items-center justify-between pb-3 border-b border-[#224b39]/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <BrandLogo size="sm" variant="light" withTagline={false} withAiBadge={false} />
            {(!isCollapsed || isMobileDrawer) && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-[#f8fbf7] tracking-tight leading-none truncate">
                  আমাদের কৃষি
                </span>
                <span className="text-[10px] text-[#e9ad46] font-semibold mt-0.5 tracking-wide uppercase">
                  আমাদের কৃষি AI
                </span>
              </div>
            )}
          </div>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobileDrawer}
              className="p-1.5 rounded-lg text-[#a7b9ae] hover:text-[#f8fbf7] hover:bg-[#153f2e]/60 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1 rounded-lg text-[#a7b9ae] hover:text-[#f8fbf7] hover:bg-[#153f2e]/60 transition-colors cursor-pointer"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label="Toggle sidebar"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )
          )}
        </div>

        {/* 2. Large Gold-Outlined "+ New Chat" Button */}
        <button
          id="sidebar-new-chat-btn"
          data-testid="sidebar-new-chat-btn"
          type="button"
          onClick={handleNewChatClick}
          className={`w-full rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm transition-all duration-200 shadow-sm cursor-pointer focus:outline-none ${
            activeTab === 'chat' && !activeChatSessionId
              ? 'border-2 border-[#e9ad46] bg-[#e9ad46]/20 text-[#e9ad46] ring-2 ring-[#e9ad46]/30 shadow-md'
              : 'border border-[#e9ad46]/60 hover:border-[#e9ad46] bg-[#e9ad46]/10 hover:bg-[#e9ad46]/20 text-[#e9ad46]'
          }`}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          {(!isCollapsed || isMobileDrawer) && (
            <span>{lang === 'bn' ? 'নতুন চ্যাট' : 'New Chat'}</span>
          )}
        </button>

        {/* 3. Section: NAVIGATION */}
        <div>
          {(!isCollapsed || isMobileDrawer) && (
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a7b9ae]/60 px-3 py-1.5">
              {lang === 'bn' ? 'নেভিগেশন' : 'NAVIGATION'}
            </div>
          )}
          <nav className="flex flex-col gap-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  data-nav-id={item.id}
                  data-model-id={item.modelId || ''}
                  type="button"
                  onClick={() => handleNavClick(item.id, item.modelId)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer text-left w-full ${
                    item.isActive
                      ? 'bg-[#153f2e] text-[#e9ad46] border border-[#224b39]/70 shadow-sm'
                      : 'text-[#a7b9ae] hover:bg-[#153f2e]/50 hover:text-[#f8fbf7]'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${item.isActive ? 'text-[#e9ad46]' : 'text-[#a7b9ae]'}`} />
                  {(!isCollapsed || isMobileDrawer) && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 4. Section: INTELLIGENCE MODULES */}
        <div>
          {(!isCollapsed || isMobileDrawer) && (
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a7b9ae]/60 px-3 py-1.5">
              {lang === 'bn' ? 'বুদ্ধিমত্তা মডিউল' : 'INTELLIGENCE MODULES'}
            </div>
          )}
          <nav className="flex flex-col gap-1">
            {intelligenceModules.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  data-nav-id={item.id}
                  data-model-id={item.modelId || ''}
                  type="button"
                  onClick={() => handleNavClick(item.id, item.modelId)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer text-left w-full ${
                    item.isActive
                      ? 'bg-[#153f2e] text-[#e9ad46] border border-[#224b39]/70 shadow-sm'
                      : 'text-[#a7b9ae] hover:bg-[#153f2e]/50 hover:text-[#f8fbf7]'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${item.isActive ? 'text-[#e9ad46]' : 'text-[#a7b9ae]'}`} />
                  {(!isCollapsed || isMobileDrawer) && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 5. Section: ADVANCED 360° & PLATFORM TOOLS (Collapsible group) */}
        <div>
          {(!isCollapsed || isMobileDrawer) && (
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-[#a7b9ae]/60 px-3 py-1.5 hover:text-[#f8fbf7] cursor-pointer"
            >
              <span>{lang === 'bn' ? '৩৬০° প্ল্যাটফর্ম ফিচার' : '360° MORE MODULES'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isAdvancedOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
          {(isAdvancedOpen || isCollapsed) && (
            <nav className="flex flex-col gap-1 mt-1 pl-1">
              {advancedModules.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleNavClick(item.id, item.modelId)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left w-full ${
                      item.isActive
                        ? 'bg-[#153f2e] text-[#e9ad46] border border-[#224b39]/70 shadow-sm'
                        : 'text-[#a7b9ae] hover:bg-[#153f2e]/50 hover:text-[#f8fbf7]'
                    }`}
                    title={item.label}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${item.isActive ? 'text-[#e9ad46]' : 'text-[#a7b9ae]'}`} />
                      {(!isCollapsed || isMobileDrawer) && <span className="truncate">{item.label}</span>}
                    </div>
                    {item.badge && (!isCollapsed || isMobileDrawer) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#0b3325] border border-[#224b39] text-emerald-400 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* 6. Section: RECENTS (Recent Chat Consultations) */}
        {chatSessions.length > 0 && (!isCollapsed || isMobileDrawer) && (
          <div className="pt-2 border-t border-[#224b39]/30">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a7b9ae]/60 px-3 py-1">
              {lang === 'bn' ? 'সাম্প্রতিক চ্যাট' : 'RECENTS'}
            </div>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto krishi-scrollbar pr-1">
              {chatSessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSessionClick(session)}
                  className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    activeChatSessionId === session.id
                      ? 'bg-[#153f2e] text-[#e9ad46] font-medium'
                      : 'text-[#a7b9ae] hover:bg-[#153f2e]/40 hover:text-[#f8fbf7]'
                  }`}
                >
                  <span className="truncate text-xs">{session.title}</span>
                  <button
                    type="button"
                    onClick={(e) => confirmDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 rounded transition-opacity"
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* 7. Bottom Controls Section (Language, Mode, Location, Logout) */}
      <div className="pt-3 border-t border-[#224b39]/40 flex flex-col gap-2.5">
        
        {/* Toggle 1: English / বাংলা segmented control */}
        {(!isCollapsed || isMobileDrawer) && (
          <div className="flex rounded-xl border border-[#224b39] bg-[#062519] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { if (lang !== 'en') toggleLang(); }}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                lang === 'en'
                  ? 'bg-[#e9ad46] text-[#111610] shadow-sm font-bold'
                  : 'text-[#a7b9ae] hover:text-[#f8fbf7]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => { if (lang !== 'bn') toggleLang(); }}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                lang === 'bn'
                  ? 'bg-[#e9ad46] text-[#111610] shadow-sm font-bold'
                  : 'text-[#a7b9ae] hover:text-[#f8fbf7]'
              }`}
            >
              বাংলা
            </button>
          </div>
        )}

        {/* Toggle 2: Farmer / Expert segmented control */}
        {(!isCollapsed || isMobileDrawer) && (
          <div className="flex rounded-xl border border-[#224b39] bg-[#062519] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setUserMode('farmer')}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                userMode === 'farmer'
                  ? 'bg-[#153f2e] text-[#37b97f] font-bold shadow-xs'
                  : 'text-[#a7b9ae] hover:text-[#f8fbf7]'
              }`}
            >
              {lang === 'bn' ? 'কৃষক' : 'Farmer'}
            </button>
            <button
              type="button"
              onClick={() => {
                setUserMode('expert');
                alert(
                  lang === 'bn'
                    ? 'বিশেষজ্ঞ মোড: বিস্তারিত বৈজ্ঞানিক ডেটাসেট ও ম্যাট্রিক্স ভিউ সক্রিয় করা হয়েছে।'
                    : 'Expert Mode: Detailed agronomic metrics and feature arrays enabled.'
                );
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                userMode === 'expert'
                  ? 'bg-[#153f2e] text-[#37b97f] font-bold shadow-xs'
                  : 'text-[#a7b9ae] hover:text-[#f8fbf7]'
              }`}
            >
              {lang === 'bn' ? 'বিশেষজ্ঞ' : 'Expert'}
            </button>
          </div>
        )}

        {/* Location Indicator Pill */}
        {(!isCollapsed || isMobileDrawer) && (
          <div className="flex items-center gap-2 rounded-xl bg-[#0b3325]/70 border border-[#224b39]/70 px-3 py-2 text-xs text-[#a7b9ae]">
            <MapPin className="w-3.5 h-3.5 text-[#e9ad46] shrink-0" />
            <span className="truncate text-xs">{userLocationText}</span>
          </div>
        )}

        {/* User Info & Logout Button */}
        <div className="flex items-center justify-between pt-1">
          {(!isCollapsed || isMobileDrawer) && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#153f2e] text-[#e9ad46] flex items-center justify-center font-bold text-xs shrink-0 border border-[#224b39]">
                {user?.username ? user.username[0].toUpperCase() : 'ক'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[#f8fbf7] truncate">
                  {user?.username || (lang === 'bn' ? 'কৃষক ভাই' : 'Farmer')}
                </span>
                <span className="text-[10px] text-emerald-400 truncate">
                  {isDemo ? (lang === 'bn' ? 'ডেমো অ্যাকাউন্ট' : 'Demo Account') : user?.email || (lang === 'bn' ? 'সক্রিয়' : 'Active')}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={logout}
            className="p-1.5 rounded-lg text-[#a7b9ae] hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
            title={lang === 'bn' ? 'লগআউট' : 'Sign Out'}
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>
    </aside>
  );
}

export default WorkspaceSidebar;
