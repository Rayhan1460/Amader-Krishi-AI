import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Menu,
  MapPin,
  Home as HomeIcon,
  Calendar as CalendarIcon,
  Camera,
  TrendingUp,
  Grid,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { systemApi, historyApi, chatApi, farmApi } from '../services/api.ts';
import type { HealthResponse, ChatSession, FarmProfile } from '../types/index.ts';
import { WorkspaceSidebar, type WorkspaceTab } from '../components/workspace/WorkspaceSidebar.tsx';
import { ChatHomepageView } from '../components/workspace/ChatHomepageView.tsx';
import { WorkspaceDashboardView } from '../components/workspace/WorkspaceDashboardView.tsx';
import { WorkspaceCalendarView } from '../components/workspace/WorkspaceCalendarView.tsx';
import { FarmDigitalTwinView } from '../components/workspace/FarmDigitalTwinView.tsx';
import { SoilHealthDashboard } from '../components/workspace/SoilHealthDashboard.tsx';
import { CropMonitoringDashboard } from '../components/workspace/CropMonitoringDashboard.tsx';
import { HarvestManagementDashboard } from '../components/workspace/HarvestManagementDashboard.tsx';
import { FarmIntelligenceDashboard } from '../components/workspace/FarmIntelligenceDashboard.tsx';
import { ChatView } from '../components/workspace/ChatView.tsx';
import { ModelToolsView } from '../components/workspace/ModelToolsView.tsx';
import { PredictionHistoryView } from '../components/workspace/PredictionHistoryView.tsx';
import { PremiumFarmDashboard } from '../components/workspace/dashboard/PremiumFarmDashboard.tsx';
import { BrandLogo } from '../components/common/BrandLogo.tsx';

export function WorkspacePage() {
  const { isDemo } = useAuth();
  const { lang } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as WorkspaceTab | null;
  const validTabs: WorkspaceTab[] = [
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
  const [initialQuery, setInitialQuery] = useState<string>('');
  const [isSendingFromHomepage, setIsSendingFromHomepage] = useState(false);

  // Sidebar Layout State (Desktop Collapse & Mobile Drawer)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

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

    async function loadSessions() {
      try {
        const sessions = await chatApi.listSessions();
        if (isMounted) {
          setChatSessions(sessions);
          if (sessions.length > 0 && !activeChatSessionId) {
            setActiveChatSessionId(sessions[0].id);
          }
        }
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
    loadSessions();
    loadFarms();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as WorkspaceTab | null;
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
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
    setIsMobileDrawerOpen(false);
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
    setActiveChatSessionId(null);
    setInitialQuery('');
    setActiveTab('chat');
    setSearchParams({ tab: 'chat' }, { replace: true });
  };

  const handleSelectChatSession = (session: ChatSession) => {
    setActiveChatSessionId(session.id);
    setActiveTab('chat');
    setSearchParams({ tab: 'chat' }, { replace: true });
  };

  const handleDeleteChatSession = async (sessionId: number) => {
    try {
      await chatApi.deleteSession(sessionId);
      const remaining = chatSessions.filter((s) => s.id !== sessionId);
      setChatSessions(remaining);
      if (activeChatSessionId === sessionId) {
        setActiveChatSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete chat session:', err);
    }
  };

  // Real Chat API integration from Homepage input & suggestion cards
  const handleHomepageSendMessage = async (content: string) => {
    setIsSendingFromHomepage(true);
    try {
      let targetSession = chatSessions.find((s) => s.id === activeChatSessionId) || null;
      if (!targetSession) {
        const title = content.slice(0, 30) || (lang === 'bn' ? 'কৃষি পরামর্শ' : 'Farm Consultation');
        targetSession = await chatApi.createSession(title);
        setChatSessions([targetSession, ...chatSessions]);
        setActiveChatSessionId(targetSession.id);
      }

      // Optimistically switch to chat with the query
      setInitialQuery(content);
      const updated = await chatApi.postMessage(targetSession.id, content);
      setChatSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setActiveChatSessionId(updated.id);
      setActiveTab('chat');
      setSearchParams({ tab: 'chat' }, { replace: true });
    } catch (err) {
      console.error('Error posting message from homepage:', err);
      setInitialQuery(content);
      setActiveTab('chat');
      setSearchParams({ tab: 'chat' }, { replace: true });
    } finally {
      setIsSendingFromHomepage(false);
    }
  };

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) ?? null;
  const userLocationText = selectedFarm
    ? [selectedFarm.village, selectedFarm.upazila, selectedFarm.district].filter(Boolean).join(', ')
    : lang === 'bn'
      ? 'খামার নির্বাচন করুন'
      : 'Select your farm';

  return (
    <div className="krishi-pro-app min-h-screen bg-[#001c12] text-[#f8fbf7] flex flex-col lg:flex-row overflow-x-hidden w-full max-w-full">
      
      {/* 1. Mobile Top Header Bar (matching 02_reference_mobile.png) */}
      <header className="lg:hidden sticky top-0 z-40 h-14 bg-[#111610]/95 backdrop-blur-md border-b border-[#224b39]/40 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-2 rounded-xl text-[#a7b9ae] hover:text-[#f8fbf7] hover:bg-[#153f2e]/60 transition-colors cursor-pointer"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <BrandLogo size="sm" variant="light" showText={false} withTagline={false} withAiBadge={false} />
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

      {/* 2. Mobile Drawer Backdrop & Sidebar Container */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#111610] z-50 shadow-2xl animate-fade-in-up">
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
              isMobileDrawer={true}
              onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
              farmLocation={userLocationText}
            />
          </div>
        </div>
      )}

      {/* 3. Desktop Left Sidebar (Fixed / Sticky 272px) */}
      <div className="hidden lg:block shrink-0 sticky top-0 h-screen z-40">
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
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          farmLocation={userLocationText}
        />
      </div>

      {/* 4. Main Working Region */}
      <main className="flex-1 w-full min-w-0 flex flex-col pb-18 lg:pb-0 min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
        
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

        {/* View 2: ChatGPT-Style Agricultural Assistant & Chat Homepage (matching 01_chat_home_reference.png) */}
        {activeTab === 'chat' && (
          !activeChatSessionId && !initialQuery ? (
            <ChatHomepageView
              onNavigateToTab={handleNavigate}
              onSendMessage={handleHomepageSendMessage}
              isSending={isSendingFromHomepage}
            />
          ) : (
            <div className="p-3 sm:p-6 flex-1 flex flex-col">
              <ChatView
                onSelectModelTool={handleLaunchTool}
                externalActiveSessionId={activeChatSessionId}
                onSessionsLoaded={(loaded) => setChatSessions(loaded)}
                initialQuery={initialQuery}
                onClearInitialQuery={() => setInitialQuery('')}
              />
            </div>
          )
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
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#111610]/95 backdrop-blur-xl border-t border-[#224b39]/40 flex items-center justify-around px-2 shadow-2xl">
        
        {/* Home */}
        <button
          type="button"
          onClick={() => handleNavigate('dashboard')}
          className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] transition-colors ${
            activeTab === 'dashboard' || activeTab === 'chat'
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
          onClick={() => handleNavigate('crop_monitoring')}
          className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] transition-colors ${
            activeTab === 'crop_monitoring'
              ? 'text-[#e9ad46] font-bold'
              : 'text-[#a7b9ae] hover:text-[#f8fbf7]'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span>{lang === 'bn' ? 'স্ক্যান' : 'Scan'}</span>
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
          onClick={() => setIsMobileDrawerOpen(true)}
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
