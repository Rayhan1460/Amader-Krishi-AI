import './farmhub/FarmHubSidebar.css';
import { FarmHubMark } from './farmhub/FarmHubMark.tsx';
import { Calculator, Users, Tractor } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  CloudRain,
  Sprout,
  Eye,
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
  MessageSquare,
  Search,
  Download,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ChatSession } from '../../types/index.ts';

export type WorkspaceTab =
  | 'farm_plan' | 'farm_finance' | 'farm_community' | 'farm_services'
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
  chatLoading?: boolean;
  chatWorking?: boolean;
  chatHistoryError?: string;
  onRetryChatHistory?: () => void;
  sessionExpired?: boolean;
  onSignIn?: () => void;
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
  chatLoading,
  chatWorking,
  chatHistoryError,
  onRetryChatHistory,
  sessionExpired,
  onSignIn,
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

  const [historyOpen, setHistoryOpen] = useState(activeTab === 'chat');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'chat') setHistoryOpen(true);
  }, [activeTab]);

  const clock = new Date();
  const query = search.trim().normalize('NFC').toLocaleLowerCase();
  const recentSessions = chatSessions.map((session) => {
    const stamp = session.messages.at(-1)?.timestamp ?? session.created_at;
    const date = new Date(/T/.test(stamp) && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(stamp) ? stamp + 'Z' : stamp);
    return { session, date };
  }).filter(({ session }) => session.title.normalize('NFC').toLocaleLowerCase().includes(query))
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.session.id - a.session.id);
  const groups = [
    { label: t('আজ', 'Today'), today: true },
    { label: t('আগের চ্যাট', 'Earlier chats'), today: false },
  ];

  function downloadSession(session: ChatSession) {
    const transcript = session.messages.map((message) =>
      `${message.role === 'user' ? t('আপনি', 'You') : t('আমাদের কৃষি AI', 'Amader Krishi AI')}\n${message.content}`,
    ).join('\n\n');
    const href = URL.createObjectURL(new Blob(['\ufeff', session.title, '\n\n', transcript], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = `agrisphere-chat-${session.id}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

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
    if (onSelectChatSession) onSelectChatSession(session);
    else onSelectTab('chat');
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
      id: 'farm_plan' as WorkspaceTab,
      modelId: undefined,
      label: lang === 'bn' ? 'মাটি ও ফসল পরিকল্পনা' : 'Soil & Crop Planning',
      icon: Sprout,
      isActive: activeTab === 'farm_plan',
    },
    {
      id: 'farm_finance' as WorkspaceTab,
      modelId: undefined,
      label: lang === 'bn' ? 'বাজেট ও লাভ' : 'Budget & Profit',
      icon: Calculator,
      isActive: activeTab === 'farm_finance',
    },
    {
      id: 'tools' as WorkspaceTab,
      modelId: 'tomato_disease_v3',
      label: lang === 'bn' ? 'ফসল স্বাস্থ্য' : 'Crop Health',
      icon: Eye,
      isActive: activeTab === 'tools' && ['tomato_disease_v3', 'rice_disease'].includes(selectedModelId || ''),
    },
    {
      id: 'farm_community' as WorkspaceTab,
      modelId: undefined,
      label: lang === 'bn' ? 'কমিউনিটি' : 'Community',
      icon: Users,
      isActive: activeTab === 'farm_community',
    },
    {
      id: 'farm_services' as WorkspaceTab,
      modelId: undefined,
      label: lang === 'bn' ? 'খামার সেবা ও রেকর্ড' : 'Farm Services & Records',
      icon: Tractor,
      isActive: activeTab === 'farm_services',
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
      id: 'crop_monitoring' as WorkspaceTab,
      label: lang === 'bn' ? 'ফসল পর্যবেক্ষণ' : 'Crop Monitoring',
      icon: Eye,
      badge: 'Farm',
      isActive: activeTab === 'crop_monitoring',
    },
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
      isActive: activeTab === 'tools' && !['flood_susceptibility', 'crop_recommendation', 'regional_crop_yield', 'tomato_price', 'boro_rice_price', 'tomato_disease_v3', 'rice_disease'].includes(selectedModelId || ''),
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
      className={`fh-sidebar krishi-workspace-sidebar krishi-glass-panel text-[#f8fbf7] flex flex-col justify-between transition-all duration-300 ${
        isMobileDrawer
          ? 'w-full h-full p-4 overflow-y-auto'
          : isCollapsed
          ? 'w-20 h-screen p-2 shrink-0'
          : 'w-[272px] p-3.5 shrink-0 h-screen sticky top-0 overflow-y-auto krishi-scrollbar'
      }`}
    >
      <div className="fh-sidebar-body flex flex-col gap-3">
        
        {/* 1. Header: Brand Logo & Wordmark + Collapse Button */}
        <div className="flex items-center justify-between pb-3 border-b border-[#224b39]/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <FarmHubMark />
            {(!isCollapsed || isMobileDrawer) && (
              <div className="flex flex-col min-w-0">
                <span className="krishi-sidebar-wordmark font-bold text-sm text-[#f8fbf7] leading-none truncate">
                  {t('আমাদের কৃষি AI', 'Amader Krishi AI')}
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
          aria-label={t('নতুন চ্যাট', 'New Chat')}
          disabled={chatWorking}
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

        <section className="krishi-chat-history" aria-label={t('চ্যাট ইতিহাস', 'Chat history')}>
          <button type="button" className="krishi-history-toggle" aria-expanded={historyOpen} title={t('চ্যাট ইতিহাস', 'Chat history')}
            onClick={() => {
              if (isCollapsed && window.matchMedia('(min-width: 1024px)').matches) {
                onToggleCollapse?.();
                setHistoryOpen(true);
              } else setHistoryOpen((value) => !value);
            }}>
            <MessageSquare aria-hidden="true" />
            <span className="krishi-history-label">{t('চ্যাট ইতিহাস', 'Chat history')}</span>
            <ChevronDown className="krishi-history-chevron" aria-hidden="true" />
          </button>
          {historyOpen && (!isCollapsed || isMobileDrawer) && (
            <div className="krishi-history-content">
              <label className="krishi-history-search">
                <Search aria-hidden="true" />
                <input type="search" aria-label={t('চ্যাট খুঁজুন', 'Search chats')} placeholder={t('চ্যাট খুঁজুন…', 'Search chats…')}
                  value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <div className="krishi-history-scroll">
                {sessionExpired ? <p>{t('সেশনের মেয়াদ শেষ।', 'Session expired.')} <button type="button" className="krishi-text-link" onClick={onSignIn}>{t('আবার লগইন করুন', 'Sign in again')}</button></p>
                  : chatHistoryError ? <p role="alert">{chatHistoryError} <button type="button" className="krishi-text-link" onClick={onRetryChatHistory} disabled={chatWorking}>{t('আবার চেষ্টা', 'Retry')}</button></p>
                  : chatLoading ? <p>{t('চ্যাট লোড হচ্ছে…', 'Loading chats…')}</p>
                  : recentSessions.length === 0 ? <p>{query ? t('চ্যাট পাওয়া যায়নি।', 'No matching chats.') : t('এখনো কোনো চ্যাট নেই।', 'No chats yet.')}</p>
                  : groups.map((group) => {
                    const items = recentSessions.filter(({ date }) => (date.toDateString() === clock.toDateString()) === group.today);
                    if (items.length === 0) return null;
                    return (
                      <div className="krishi-history-group" key={group.label}>
                        <h2>{group.label}</h2>
                        {items.map(({ session }) => (
                          <div className="krishi-history-row" key={session.id} data-current={activeTab === 'chat' && activeChatSessionId === session.id}>
                            <button type="button" className="krishi-history-title" onClick={() => handleSessionClick(session)} disabled={chatWorking}
                              aria-current={activeTab === 'chat' && activeChatSessionId === session.id ? 'true' : undefined} title={session.title}>
                              {session.title}
                            </button>
                            <button type="button" className="krishi-history-action" aria-label={t('চ্যাট ডাউনলোড', 'Download chat')} onClick={() => downloadSession(session)}><Download aria-hidden="true" /></button>
                            <button type="button" className="krishi-history-action" aria-label={t('চ্যাট মুছুন', 'Delete chat')} onClick={(event) => confirmDeleteSession(event, session.id)} disabled={chatWorking}><Trash2 aria-hidden="true" /></button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </section>

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
                  aria-current={item.isActive ? 'page' : undefined}
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
              {lang === 'bn' ? 'খামার ও ফসল' : 'FARM & CROPS'}
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
                  aria-current={item.isActive ? 'page' : undefined}
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
              <span>{lang === 'bn' ? 'আরও ফিচার' : 'MORE TOOLS'}</span>
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
                  aria-current={item.isActive ? 'page' : undefined}
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


      </div>

      {/* 7. Bottom Controls Section (Language, Mode, Location, Logout) */}
      <div className="fh-sidebar-foot pt-3 border-t border-[#224b39]/40 flex flex-col gap-2.5">
        
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
