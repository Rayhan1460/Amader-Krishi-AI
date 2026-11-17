import { Sprout as FarmPlanningIcon } from 'lucide-react';
import { FarmHubMark } from '../components/workspace/farmhub/FarmHubMark.tsx';
import { FarmHub, isHubPage } from '../components/workspace/farmhub/FarmHub.tsx';
import { useState, useEffect, useRef, useCallback } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Menu,
  MapPin,
  Home as HomeIcon,
  Calendar as CalendarIcon,
  TrendingUp,
  Grid,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { systemApi, historyApi, chatApi, farmApi, getErrorMessage } from '../services/api.ts';
import type { HealthResponse, ChatSession, FarmProfile } from '../types/index.ts';
import { WorkspaceSidebar, type WorkspaceTab } from '../components/workspace/WorkspaceSidebar.tsx';
import { WorkspaceDashboardView } from '../components/workspace/WorkspaceDashboardView.tsx';
import { WorkspaceCalendarView } from '../components/workspace/WorkspaceCalendarView.tsx';
import { FarmDigitalTwinView } from '../components/workspace/FarmDigitalTwinView.tsx';
import { SoilHealthDashboard } from '../components/workspace/SoilHealthDashboard.tsx';
import { CropMonitoringDashboard } from '../components/workspace/CropMonitoringDashboard.tsx';
import { HarvestManagementDashboard } from '../components/workspace/HarvestManagementDashboard.tsx';
import { FarmIntelligenceDashboard } from '../components/workspace/FarmIntelligenceDashboard.tsx';
import { ChatView, type ChatEntry } from '../components/workspace/ChatView.tsx';
import { ModelToolsView } from '../components/workspace/ModelToolsView.tsx';
import { PredictionHistoryView } from '../components/workspace/PredictionHistoryView.tsx';
import { PremiumFarmDashboard } from '../components/workspace/dashboard/PremiumFarmDashboard.tsx';

export function WorkspacePage() {
  const { isDemo, logout } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as WorkspaceTab | null;
  const validTabs: WorkspaceTab[] = [
    'farm_plan', 'farm_finance', 'farm_community', 'farm_services',
    'dashboard',
    'smart_center',
    'chat',
    'tools',
    'calendar',
    'farm_twin',
    'soil_health',
    'crop_monitoring',
    'harvest',
    'history',
    'overview',
  ];
  const initialTab = urlTab && validTabs.includes(urlTab) ? urlTab : 'dashboard';
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [selectedModelId, setSelectedModelId] = useState<string>('tomato_disease_v3');
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [selectedFarmIdForIntelligence, setSelectedFarmIdForIntelligence] = useState<number | null>(null);
  const [selectedFarmIdForSoil, setSelectedFarmIdForSoil] = useState<number | null>(null);
  const [selectedFarmIdForCrop, setSelectedFarmIdForCrop] = useState<number | null>(null);
  const [selectedFarmIdForMonitoring, setSelectedFarmIdForMonitoring] = useState<number | null>(null);
  const [selectedCropIdForMonitoring, setSelectedCropIdForMonitoring] = useState<number | null>(null);
  const [selectedFarmIdForHarvest, setSelectedFarmIdForHarvest] = useState<number | null>(null);
  const [selectedCropIdForHarvest, setSelectedCropIdForHarvest] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);

  // Chat Sessions Sync between Sidebar and ChatView
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<number | null>(null);
  const [chatEntry, setChatEntry] = useState<ChatEntry | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatWorking, setChatWorking] = useState(false);
  const [chatHistoryError, setChatHistoryError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const chatLoad = useRef(0);
  const canSendChat = chatLoading || chatWorking || sessionExpired;

  function reauthenticate() {
    logout();
    navigate('/login', {
      replace: true,
      state: { from: { pathname: '/workspace?tab=chat' } },
    });
  }

  function captureSessionError(error: unknown) {
    if (isAxiosError(error) && error.response?.status === 401) {
      setSessionExpired(true);
      return true;
    }
    return false;
  }

  // Sidebar Layout State (Desktop Collapse & Mobile Drawer)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const drawerTrigger = useRef<HTMLElement | null>(null);
  const shell = useRef<HTMLDivElement>(null);

  function openDrawer() {
    drawerTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsMobileDrawerOpen(true);
  }

  const closeDrawer = useCallback((restoreFocus = true) => {
    setIsMobileDrawerOpen(false);
    if (restoreFocus) requestAnimationFrame(() => drawerTrigger.current?.focus());
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    function updateHeight() {
      if (viewport && viewport.scale === 1) {
        shell.current?.style.setProperty('--workspace-height', `${viewport.height}px`);
      }
    }
    updateHeight();
    viewport.addEventListener('resize', updateHeight);
    return () => viewport.removeEventListener('resize', updateHeight);
  }, []);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const narrow = window.matchMedia('(max-width: 1023px)');
    const closeAtDesktop = () => { if (!narrow.matches) closeDrawer(false); };
    narrow.addEventListener('change', closeAtDesktop);
    drawer.current?.querySelector<HTMLElement>('.krishi-drawer-close')?.focus();
    return () => narrow.removeEventListener('change', closeAtDesktop);
  }, [isMobileDrawerOpen, closeDrawer]);

  useEffect(() => {
    let isMounted = true;
    async function fetchStatus() {
      try {
        const h = await systemApi.getHealth();
        if (isMounted) setHealth(h);
      } catch (err) {
        console.error('Failed to load system health:', err);
      }
    }

    async function fetchCount() {
      try {
        const hist = await historyApi.listHistory(100);
        if (isMounted) setHistoryCount(hist.length);
      } catch {
        // silent fallback
      }
    }

    async function loadFarms() {
      try {
        const loadedFarms = await farmApi.listFarms();
        if (isMounted) {
          setFarms(loadedFarms);
          const activeFarm = loadedFarms.find((farm) => farm.is_active) ?? loadedFarms[0] ?? null;
          setSelectedFarmId((current) => loadedFarms.some((farm) => farm.id === current) ? current : activeFarm?.id ?? null);
        }
      } catch {
        // Keep the neutral no-farm state when farm data is unavailable.
      }
    }

    fetchStatus();
    fetchCount();
    loadFarms();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const loadChatHistory = useCallback(async () => {
    const request = ++chatLoad.current;
    setChatLoading(true);
    setChatHistoryError('');
    try {
      const result = await chatApi.listSessions();
      if (chatLoad.current === request) {
        setChatSessions(result);
        setSessionExpired(false);
      }
    } catch (error) {
      if (chatLoad.current !== request) return;
      if (isAxiosError(error) && error.response?.status === 401) setSessionExpired(true);
      else setChatHistoryError(getErrorMessage(error));
    } finally {
      if (chatLoad.current === request) setChatLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChatHistory();
    return () => { chatLoad.current += 1; };
  }, [loadChatHistory]);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as WorkspaceTab | null;
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
      const marketModel = searchParams.get('model');
      const landingModels = ['tomato_price', 'boro_rice_price', 'tomato_disease_v3', 'rice_disease', 'flood_susceptibility', 'crop_recommendation', 'regional_crop_yield'];
      if (tabParam === 'tools' && marketModel && landingModels.includes(marketModel)) {
        setSelectedModelId(marketModel);
      }
    }
  }, [searchParams]);

  const handleNavigate = (tab: WorkspaceTab, modelIdOrFarmId?: string, extraId?: number) => {
    if (tab === 'tools') {
      if (modelIdOrFarmId) {
        setSelectedModelId(modelIdOrFarmId);
      }
      if (extraId) {
        setSelectedFarmIdForCrop(extraId);
      }
    } else if (tab === 'smart_center' && modelIdOrFarmId && !isNaN(Number(modelIdOrFarmId))) {
      setSelectedFarmIdForIntelligence(Number(modelIdOrFarmId));
    } else if (tab === 'soil_health' && modelIdOrFarmId && !isNaN(Number(modelIdOrFarmId))) {
      setSelectedFarmIdForSoil(Number(modelIdOrFarmId));
    } else if (tab === 'crop_monitoring') {
      if (modelIdOrFarmId && !isNaN(Number(modelIdOrFarmId))) {
        setSelectedFarmIdForMonitoring(Number(modelIdOrFarmId));
      }
      if (extraId) {
        setSelectedCropIdForMonitoring(extraId);
      }
    } else if (tab === 'harvest') {
      if (modelIdOrFarmId && !isNaN(Number(modelIdOrFarmId))) {
        setSelectedFarmIdForHarvest(Number(modelIdOrFarmId));
      }
      if (extraId) {
        setSelectedCropIdForHarvest(extraId);
      }
    }
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
    closeDrawer(false);
  };

  const handleLaunchTool = (modelId: string) => {
    setSelectedModelId(modelId);
    setActiveTab('tools');
    setSearchParams({ tab: 'tools' }, { replace: true });
  };

  const handleViewHistory = (recordId: number) => {
    setSelectedRecordId(recordId);
    setActiveTab('history');
    setSearchParams({ tab: 'history' }, { replace: true });
  };

  const handleCreateNewChat = () => {
    if (chatWorking) return;
    setActiveChatSessionId(null);
    setChatEntry(null);
    setActiveTab('chat');
    setSearchParams({ tab: 'chat' }, { replace: true });
    closeDrawer(false);
  };

  const handleSelectChatSession = (session: ChatSession) => {
    if (chatWorking) return;
    setActiveChatSessionId(session.id);
    setChatEntry(null);
    setActiveTab('chat');
    setSearchParams({ tab: 'chat' }, { replace: true });
    closeDrawer(false);
  };

  const handleDeleteChatSession = async (sessionId: number) => {
    if (canSendChat) return;
    setChatWorking(true);
    setChatHistoryError('');
    try {
      await chatApi.deleteSession(sessionId);
      setChatSessions((sessions) => sessions.filter((session) => session.id !== sessionId));
      setActiveChatSessionId((active) => active === sessionId ? null : active);
    } catch (error) {
      if (!captureSessionError(error)) setChatHistoryError(getErrorMessage(error));
    } finally {
      setChatWorking(false);
    }
  };

  const handleHomepageSendMessage = (content: string) => {
    setActiveChatSessionId(null);
    setChatEntry({ content });
    handleNavigate('chat');
  };

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) ?? null;
  const userLocationText = selectedFarm
    ? [selectedFarm.village, selectedFarm.upazila, selectedFarm.district].filter(Boolean).join(', ')
    : lang === 'bn'
      ? 'খামার নির্বাচন করুন'
      : 'Select your farm';

  const chatOpen = activeTab === 'chat';

  return (
    <div ref={shell} className={`krishi-pro-app krishi-workspace${chatOpen ? ' krishi-workspace--chat' : ''}${isSidebarCollapsed ? ' is-collapsed' : ''}`}>
      {/* 1. Mobile Top Header Bar (matching 02_reference_mobile.png) */}
      <header inert={isMobileDrawerOpen} hidden={chatOpen} className="krishi-mobile-header lg:hidden sticky top-0 z-40 h-14 bg-[#111610]/95 backdrop-blur-md border-b border-[#224b39]/40 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openDrawer}
            className="p-2 rounded-xl text-[#a7b9ae] hover:text-[#f8fbf7] hover:bg-[#153f2e]/60 transition-colors cursor-pointer"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <FarmHubMark />
            <span className="font-extrabold text-sm text-[#e9ad46] tracking-tight">
              আমাদের কৃষি
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Demo Mode Badge for automated test and user identification */}
          {isDemo && (
            <div
              id="demo-mode-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e9ad46]/20 text-[#e9ad46] border border-[#e9ad46]/40"
            >
              <Sparkles className="w-3 h-3" />
              <span>{lang === 'bn' ? 'ডেমো' : 'Demo'}</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-[#a7b9ae] bg-[#0b3325]/70 border border-[#224b39]/60 px-2.5 py-1 rounded-full">
            <MapPin className="w-3 h-3 text-[#e9ad46]" />
            <span className="truncate max-w-[100px]">{userLocationText}</span>
          </div>
        </div>
      </header>

      <button type="button" tabIndex={-1} aria-hidden="true" className={`krishi-drawer-overlay${isMobileDrawerOpen ? ' is-open' : ''}`} onClick={() => closeDrawer()} />
      <div ref={drawer} id="krishi-workspace-sidebar" className={`krishi-sidebar-shell${isMobileDrawerOpen ? ' is-open' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && isMobileDrawerOpen) closeDrawer();
          if (event.key !== 'Tab' || !isMobileDrawerOpen) return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary, a[href]'))
            .filter((control) => control.getClientRects().length);
          if (controls.length === 0) return;
          const edge = event.shiftKey ? controls[0] : controls.at(-1);
          if (document.activeElement === edge) {
            event.preventDefault();
            (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
          }
        }}>
        <button type="button" className="krishi-drawer-close" onClick={() => closeDrawer()}
          aria-label={lang === 'bn' ? 'মেনু বন্ধ করুন' : 'Close menu'}><X aria-hidden="true" /></button>
        <WorkspaceSidebar
          activeTab={activeTab}
          onSelectTab={handleNavigate}
          selectedModelId={selectedModelId}
          historyCount={historyCount}
          chatSessions={chatSessions}
          activeChatSessionId={activeChatSessionId}
          onSelectChatSession={handleSelectChatSession}
          onCreateNewChat={handleCreateNewChat}
          onDeleteChatSession={handleDeleteChatSession}
          chatLoading={chatLoading}
          chatWorking={chatWorking}
          chatHistoryError={chatHistoryError}
          onRetryChatHistory={() => void loadChatHistory()}
          sessionExpired={sessionExpired}
          onSignIn={reauthenticate}
          isCollapsed={isSidebarCollapsed && !isMobileDrawerOpen}
          onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
          farmLocation={userLocationText}
        />
      </div>

      {/* 4. Main Working Region */}
      <main inert={isMobileDrawerOpen} className="krishi-workspace-main flex-1 w-full min-w-0 flex flex-col pb-18 lg:pb-0 min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
        
        {/* Hidden persistent badge for test assertions on desktop */}
        {isDemo && (
          <span id="demo-mode-badge" className="hidden lg:block sr-only">
            Demo Mode Active
          </span>
        )}

        {/* View 1: Main Premium Farm Dashboard (matching 02_dashboard_reference.png) */}
        {activeTab === 'dashboard' && (
          <PremiumFarmDashboard
            initialFarmId={selectedFarmId}
            onNavigateToTab={handleNavigate}
            onSelectFarmId={setSelectedFarmId}
          />
        )}

        {chatOpen && (
          <ChatView
            sessions={chatSessions}
            onSessionsChange={setChatSessions}
            activeSessionId={activeChatSessionId}
            onActiveSessionChange={setActiveChatSessionId}
            onSelectModelTool={handleLaunchTool}
            entry={chatEntry}
            onEntryHandled={() => setChatEntry(null)}
            onOpenSidebar={openDrawer}
            sidebarOpen={isMobileDrawerOpen}
            loading={chatLoading}
            working={chatWorking}
            onWorkingChange={setChatWorking}
            sessionExpired={sessionExpired}
            onSessionError={captureSessionError}
            onSignIn={reauthenticate}
          />
        )}

        {/* View 3: Smart Farm Center / Unified Decision Dashboard (Phase F6B) */}
        {activeTab === 'smart_center' && (
          <div className="p-3 sm:p-6 lg:p-8 flex-1">
            <FarmIntelligenceDashboard
              initialFarmId={selectedFarmIdForIntelligence}
              onNavigateToTab={handleNavigate}
              onNavigateToModel={(modelId, prefillOrFarmId) => {
                setSelectedModelId(modelId);
                if (typeof prefillOrFarmId === 'number') {
                  setSelectedFarmIdForCrop(prefillOrFarmId);
                } else if (prefillOrFarmId && typeof prefillOrFarmId === 'object' && prefillOrFarmId.farm_id) {
                  setSelectedFarmIdForCrop(Number(prefillOrFarmId.farm_id));
                }
                setActiveTab('tools');
              }}
            />
          </div>
        )}

        {/* View 4: Agricultural Calendar & Weather */}
        {activeTab === 'calendar' && (
          <div className="p-3 sm:p-6 lg:p-8 flex-1">
            <WorkspaceCalendarView onNavigateToTab={handleNavigate} />
          </div>
        )}

        {/* View 5: Farm Digital Twin (360° Dashboard) */}
        {activeTab === 'farm_twin' && (
          <div className="p-3 sm:p-6 lg:p-8 flex-1">
            <FarmDigitalTwinView
              onNavigateToTab={handleNavigate}
              onNavigateToModel={(modelId: string) => {
                setSelectedModelId(modelId);
                setActiveTab('tools');
              }}
            />
          </div>
        )}

        {/* View 6: Soil Health & Laboratory Dashboard */}
        {activeTab === 'soil_health' && (
          <div className="p-3 sm:p-6 lg:p-8 flex-1">
            <SoilHealthDashboard
              initialFarmId={selectedFarmIdForSoil}
              onNavigateToTab={handleNavigate}
              onNavigateToModel={(modelId: string) => {
                setSelectedModelId(modelId);
                setActiveTab('tools');
              }}
            />
          </div>
        )}

        {/* View 7: Crop Monitoring & Cultivation Timeline */}
        {activeTab === 'crop_monitoring' && (
          <div className="p-3 sm:p-6 lg:p-8 flex-1">
            <CropMonitoringDashboard
              initialFarmId={selectedFarmIdForMonitoring}
              initialCropId={selectedCropIdForMonitoring}
              onNavigateToTab={handleNavigate}
            />
          </div>
        )}

        {/* View 8: Harvest Management & Actual Yield Tracking */}
        {activeTab === 'harvest' && (
          <div className="p-3 sm:p-6 lg:p-8 flex-1">
            <HarvestManagementDashboard
              initialFarmId={selectedFarmIdForHarvest}
              initialCropId={selectedCropIdForHarvest}
              onNavigateToTab={handleNavigate}
            />
          </div>
        )}

        {/* View 9: 7 AI Models Console */}
        {isHubPage(activeTab) && (
          <FarmHub page={activeTab} initialFarmId={selectedFarmId} onViewHistory={handleViewHistory}
            onCalendar={() => handleNavigate('calendar')} />
        )}
        {activeTab === 'tools' && (
          <div className="p-3 sm:p-6 lg:p-8 flex-1">
            <ModelToolsView
              initialModelId={selectedModelId}
              initialFarmId={selectedFarmIdForCrop}
              onViewHistory={handleViewHistory}
              onNavigateToTab={handleNavigate}
            />
          </div>
        )}

        {/* View 10: Prediction History & Audit */}
        {activeTab === 'history' && (
          <div className="p-3 sm:p-6 lg:p-8 flex-1">
            <PredictionHistoryView
              initialRecordId={selectedRecordId}
            />
          </div>
        )}

        {/* View 11: Overview & Legacy Farm View */}
        {activeTab === 'overview' && (
          <div className="p-3 sm:p-6 lg:p-8 flex-1">
            <WorkspaceDashboardView
              onNavigateToTab={handleNavigate}
              onSendChatMessage={(msg) => handleHomepageSendMessage(msg)}
              health={health}
              historyCount={historyCount}
            />
          </div>
        )}

      </main>

      {/* 5. Mobile Bottom Navigation Bar (matching 02_reference_mobile.png) */}
      <nav inert={isMobileDrawerOpen} hidden={chatOpen} className="krishi-mobile-bottom lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#111610]/95 backdrop-blur-xl border-t border-[#224b39]/40 flex items-center justify-around px-2 shadow-2xl">
        
        {/* Home */}
        <button
          type="button"
          onClick={() => handleNavigate('dashboard')}
          className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] transition-colors ${
            activeTab === 'dashboard'
              ? 'text-[#e9ad46] font-bold'
              : 'text-[#a7b9ae] hover:text-[#f8fbf7]'
          }`}
        >
          <HomeIcon className="w-5 h-5" />
          <span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
        </button>

        {/* Calendar */}
        <button
          type="button"
          onClick={() => handleNavigate('calendar')}
          className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] transition-colors ${
            activeTab === 'calendar'
              ? 'text-[#e9ad46] font-bold'
              : 'text-[#a7b9ae] hover:text-[#f8fbf7]'
          }`}
        >
          <CalendarIcon className="w-5 h-5" />
          <span>{lang === 'bn' ? 'ক্যালেন্ডার' : 'Calendar'}</span>
        </button>

        {/* Scan */}
        <button
          type="button"
          onClick={() => handleNavigate('farm_plan')}
          className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] transition-colors ${
            activeTab === 'farm_plan'
              ? 'text-[#e9ad46] font-bold'
              : 'text-[#a7b9ae] hover:text-[#f8fbf7]'
          }`}
        >
          <FarmPlanningIcon className="w-5 h-5" />
          <span>{lang === 'bn' ? 'পরিকল্পনা' : 'Planning'}</span>
        </button>

        {/* Market */}
        <button
          type="button"
          onClick={() => handleNavigate('tools', 'tomato_price')}
          className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] transition-colors ${
            activeTab === 'tools' && (selectedModelId === 'tomato_price' || selectedModelId === 'boro_rice_price')
              ? 'text-[#e9ad46] font-bold'
              : 'text-[#a7b9ae] hover:text-[#f8fbf7]'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>{lang === 'bn' ? 'মার্কেট' : 'Market'}</span>
        </button>

        {/* Menu */}
        <button
          type="button"
          onClick={openDrawer}
          className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] text-[#a7b9ae] hover:text-[#f8fbf7] transition-colors"
        >
          <Grid className="w-5 h-5" />
          <span>{lang === 'bn' ? 'মেনু' : 'Menu'}</span>
        </button>
      </nav>

    </div>
  );
}

export default WorkspacePage;
