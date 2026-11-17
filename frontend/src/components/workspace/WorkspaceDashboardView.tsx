import { useState, type FormEvent } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Waves,
  Eye,
  TrendingUp,
  Calendar,
  Sprout,
  Bot,
  Clock,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { HealthResponse } from '../../types/index.ts';

interface WorkspaceDashboardViewProps {
  onNavigateToTab: (tab: any, modelId?: string) => void;
  onSendChatMessage?: (message: string) => void;
  health: HealthResponse | null;
  historyCount: number;
}

export function WorkspaceDashboardView({
  onNavigateToTab,
  onSendChatMessage,
  health,
  historyCount,
}: WorkspaceDashboardViewProps) {
  const { user, isDemo } = useAuth();
  const { t } = useLanguage();
  const [quickQuery, setQuickQuery] = useState('');

  const handleQuickQuerySubmit = (e: FormEvent) => {
    e.preventDefault();
    const query = quickQuery.trim();
    if (!query) return;
    if (onSendChatMessage) {
      onSendChatMessage(query);
    } else {
      onNavigateToTab('chat');
    }
  };

  const quickActionCards = [
    {
      id: 'soil_crop',
      title: t('মাটির স্বাস্থ্য ও ফসল', 'Soil Health & Crop'),
      subtitle: t('Precision Crop Recommendation', 'Soil Nutrient Matching'),
      desc: t(
        'নাইট্রোজেন (N), ফসফরাস (P), পটাশিয়াম (K), পিএইচ ও বৃষ্টিপাতের ভিত্তিতে ২২টি ফসলের উপযোগিতা।',
        'Matches Nitrogen, Phosphorus, Potassium, pH and weather data to 22 optimal crops.'
      ),
      icon: Layers,
      color: 'forest',
      badge: t('সক্রিয় মডেল', 'Active Model'),
      actionText: t('মাটি পরীক্ষা করুন', 'Test Soil Profile'),
      onClick: () => onNavigateToTab('tools', 'crop_recommendation'),
    },
    {
      id: 'weather_risk',
      title: t('আবহাওয়া ও বন্যা ঝুঁকি', 'Weather & Flood Risk'),
      subtitle: t('Flood Susceptibility Scoring', 'Hydrological Risk'),
      desc: t(
        'উচ্চতা, নদীর দূরত্ব, ঢাল ও নিষ্কাশন ঘনত্বের উপর ভিত্তি করে হাইড্রোলজিক্যাল বন্যা ঝুঁকি বিশ্লেষণ।',
        'Evaluates digital elevation, river distance, and topography to predict flood risk.'
      ),
      icon: Waves,
      color: 'sky',
      badge: t('সক্রিয় মডেল', 'Active Model'),
      actionText: t('ঝুঁকি মূল্যায়ন করুন', 'Assess Flood Risk'),
      onClick: () => onNavigateToTab('tools', 'flood_susceptibility'),
    },
    {
      id: 'crop_health',
      title: t('ফসলের স্বাস্থ্য ও রোগ', 'Crop Health & Diseases'),
      subtitle: t('Vision CNN Pathology', 'Dual Vision Models'),
      desc: t(
        'টমেটো পাতার ৮টি ও ধানের পাতার ৭টি রোগ ও পোকার আক্রমণ কৃত্রিম বুদ্ধিমত্তা দিয়ে দ্রুত সনাক্ত করুন।',
        'Vision-based pathology classification across 8 tomato and 7 rice foliar conditions.'
      ),
      icon: Eye,
      color: 'emerald',
      badge: t('২টি ভিশন মডেল', '2 Vision Models'),
      actionText: t('পাতা পরীক্ষা করুন', 'Inspect Foliage'),
      onClick: () => onNavigateToTab('tools', 'tomato_disease_v3'),
    },
    {
      id: 'market_price',
      title: t('বাজারদর পূর্বাভাস', 'Wholesale Market Prices'),
      subtitle: t('Baseline-First Pricing', 'Empirical Benchmark'),
      desc: t(
        'টমেটো ও বোরো ধানের সাপ্তাহিক পাইকারি বাজারদর। বৈজ্ঞানিক বেসলাইন-ফার্স্ট নিয়মে নির্ভরযোগ্য দর।',
        'Weekly wholesale market prices for tomato and Boro rice with strict baseline validation.'
      ),
      icon: TrendingUp,
      color: 'gold',
      badge: t('সক্রিয় মডেল', 'Active Model'),
      actionText: t('বাজারদর দেখুন', 'Check Market Prices'),
      onClick: () => onNavigateToTab('tools', 'tomato_price'),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in-up">
      
      {/* =====================================================================
          HERO BANNER — Agricultural Field Visual Inspiration
          ===================================================================== */}
      <div className="relative rounded-3xl overflow-hidden border border-forest-800/80 bg-gradient-to-br from-forest-950 via-forest-900 to-[#071810] shadow-xl">
        
        {/* Subtle Botanical / Atmospheric Overlays */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.12),transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(67,149,111,0.18),transparent_60%)] pointer-events-none" />
        
        {/* Geometric topographic contours */}
        <div className="absolute right-0 bottom-0 w-96 h-96 opacity-10 pointer-events-none">
          <svg viewBox="0 0 200 200" className="w-full h-full text-gold-400" fill="currentColor">
            <path d="M42.7,-62.9C55.6,-53.4,66.6,-41.4,72.2,-27.3C77.8,-13.2,78,3,73.4,17.7C68.7,32.4,59.3,45.6,47.1,55.3C34.9,65,20,71.2,4.8,69.5C-10.4,67.8,-25.9,58.2,-39.9,47.7C-53.8,37.3,-66.2,26,-70.6,11.8C-75,-2.4,-71.4,-19.5,-62.7,-33C-54,-46.5,-40.2,-56.3,-26.2,-65.1C-12.2,-73.9,2,-81.7,15.7,-78.9C29.4,-76.1,42.7,-62.9,42.7,-62.9Z" transform="translate(100 100)" />
          </svg>
        </div>

        <div className="relative z-10 p-6 sm:p-8 lg:p-10 text-cream-50">
          
          {/* Eyebrow & Status Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-800/80 border border-forest-700/80 text-xs font-bengali text-gold-300 shadow-2xs backdrop-blur-md">
              <Sprout className="w-3.5 h-3.5 text-gold-400" />
              <span>{t('মাটি থেকে বাজার — এক স্মার্ট সিস্টেম', 'From Soil to Market — One Smart System')}</span>
            </div>

            {isDemo && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-[11px] font-bengali font-semibold text-amber-300">
                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>{t('গেস্ট ডেমো সেশন সক্রিয়', 'Guest Demo Session Active')}</span>
              </div>
            )}
          </div>

          {/* Greeting & Headline */}
          <div className="max-w-3xl">
            <p className="font-bengali text-base sm:text-lg text-sage-300 mb-1 flex items-center gap-2">
              <span>{t('আসসালামু আলাইকুম!', 'Assalamu Alaikum!')} 👋</span>
              {user?.username && (
                <span className="font-bold text-cream-100">
                  {user.username}{t('-সাহেব', '')}
                </span>
              )}
            </p>

            <h1 className="font-bengali font-extrabold text-2xl sm:text-4xl lg:text-4xl text-cream-50 leading-tight tracking-tight mb-3">
              {t(
                'আপনার জমি, ফসল, মাটি বা বাজার নিয়ে প্রশ্ন করুন।',
                'Ask anything about your land, crops, soil, or market prices.'
              )}
            </h1>

            <p className="font-bengali text-sm sm:text-base text-gold-300 font-medium mb-6">
              {t('প্রযুক্তির ছোঁয়ায়, স্মার্ট কৃষির পথে।', 'Empowering Smart Agriculture Through Technology.')}
            </p>
          </div>

          {/* Prompt / Question Box inside Hero */}
          <form
            onSubmit={handleQuickQuerySubmit}
            className="max-w-2xl bg-forest-950/80 rounded-2xl border border-forest-700/80 p-2 sm:p-2.5 flex items-center gap-2 shadow-lg backdrop-blur-md focus-within:border-gold-400/80 transition-colors"
          >
            <Bot className="w-5 h-5 text-gold-400 shrink-0 ml-2" />
            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder={t(
                'যেমন: "টমেটো পাতার বাদামি দাগ দূর করব কীভাবে?" বা "উচ্চ নাইট্রোজেনে কোন ফসল ভালো?"',
                'e.g. "How to treat brown leaf spots?" or "Best crop for high nitrogen soil?"'
              )}
              className="flex-1 bg-transparent border-none text-xs sm:text-sm text-cream-50 placeholder:text-sage-400 focus:outline-none px-2 py-1 font-bengali"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-forest-950 text-xs font-bengali font-bold transition-all shadow-md cursor-pointer shrink-0"
            >
              <span>{t('পরামর্শ নিন', 'Ask AI')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      </div>

      {/* =====================================================================
          FOUR QUICK ACTION CARDS (Soil, Weather, Crops, Market)
          ===================================================================== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bengali font-bold text-lg sm:text-xl text-cream-100">
              {t('প্রধান কৃষি সেবা ও সক্রিয় মডেলসমূহ', 'Core Agricultural Services & Active Models')}
            </h2>
            <p className="font-bengali text-xs text-sage-400 mt-0.5">
              {t(
                'সরাসরি বৈজ্ঞানিক অ্যালগরিদম ও মেশিন লার্নিং মডেল কনসোলে প্রবেশ করুন',
                'Direct access to scientific algorithms and machine learning consoles'
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab('tools')}
            className="hidden sm:inline-flex items-center gap-1 text-xs font-bengali font-semibold text-gold-400 hover:text-gold-300 transition-colors cursor-pointer"
          >
            <span>{t('সবগুলো মডেল দেখুন (৭টি)', 'View All 7 Models')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {quickActionCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={card.onClick}
                className="group relative rounded-2xl bg-forest-900/80 hover:bg-forest-850 border border-forest-800/90 hover:border-gold-400/60 p-5 transition-all duration-300 cursor-pointer shadow-md hover:shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-forest-800/80 border border-forest-700 flex items-center justify-center text-gold-400 group-hover:scale-105 transition-transform shadow-2xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-forest-800 text-gold-300 border border-forest-700">
                      {card.badge}
                    </span>
                  </div>

                  <h3 className="font-bengali font-bold text-base text-cream-100 group-hover:text-gold-300 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-[11px] font-mono text-sage-400 mb-2">
                    {card.subtitle}
                  </p>
                  <p className="font-bengali text-xs text-sage-300 leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-forest-800 flex items-center justify-between text-xs font-bengali font-semibold text-gold-400 group-hover:text-gold-300">
                  <span>{card.actionText}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          SMART AGRICULTURAL CALENDAR PREVIEW — Coming Soon in Phase F4
          ===================================================================== */}
      <div className="rounded-3xl p-6 sm:p-7 border border-gold-500/30 bg-gradient-to-r from-forest-950 via-forest-900 to-forest-950 text-cream-50 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-400/5 blur-3xl rounded-full pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gold-400/15 border border-gold-400/30 flex items-center justify-center text-gold-400 shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-gold-400">
                  {t('কার্যকর মডিউল • ফেজ F4A', 'Active Module • Phase F4A')}
                </span>
                <span className="text-[10px] font-bengali font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {t('সক্রিয় ও কার্যকর', 'Active & Operational')}
                </span>
              </div>
              <h3 className="font-bengali font-bold text-lg sm:text-xl text-cream-100">
                {t('স্মার্ট কৃষি ক্যালেন্ডার (Smart Agricultural Calendar)', 'Smart Agricultural Calendar')}
              </h3>
              <p className="font-bengali text-xs sm:text-sm text-sage-300 max-w-2xl mt-1 leading-relaxed">
                {t(
                  'বাংলাদেশের জেলা-উপজেলা ভিত্তিক খামার প্রোফাইল, রবি ও খরিপ ফসল চক্র এবং সেচ-সার প্রয়োগের রিয়েল-টাইম কাজ ব্যবস্থাপনা ক্যালেন্ডার।',
                  'District & upazila-level farm profiles, Rabi/Kharif crop lifecycles, and real-time task management calendar for Bangladesh.'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab('calendar')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gold-400/40 bg-gold-400/10 hover:bg-gold-400/20 text-gold-300 text-xs font-bengali font-semibold transition-all shrink-0 cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>{t('স্মার্ট ক্যালেন্ডার খুলুন', 'Open Smart Calendar')}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          FARM DIGITAL TWIN 360° DASHBOARD — Phase F5A
          ===================================================================== */}
      <div className="rounded-3xl p-6 sm:p-7 border border-emerald-500/30 bg-gradient-to-r from-forest-950 via-forest-900 to-[#071d14] text-cream-50 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/5 blur-3xl rounded-full pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  {t('নতুন মডিউল • ফেজ F5A', 'New Module • Phase F5A')}
                </span>
                <span className="text-[10px] font-bengali font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {t('৩৬০° ডিজিটাল টুইন', '360° Digital Twin')}
                </span>
              </div>
              <h3 className="font-bengali font-bold text-lg sm:text-xl text-cream-100">
                {t('ফার্ম ডিজিটাল টুইন ও ৩৬০° ড্যাশবোর্ড', 'Farm Digital Twin & 360° Dashboard')}
              </h3>
              <p className="font-bengali text-xs sm:text-sm text-sage-300 max-w-2xl mt-1 leading-relaxed">
                {t(
                  'আপনার খামারের ভূমি, মাটি, চলমান ফসল, পরিক্রমার বাস্তবায়ন অগ্রগতি এবং ওপেন-মেটিও আবহাওয়ার একীভূত ডিজিটাল চিত্র।',
                  'A unified digital representation of your farmland, soil profile, active crops, schedule progress, and hyper-local weather.'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab('farm_twin')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bengali font-semibold transition-all shrink-0 cursor-pointer shadow-xs"
          >
            <Activity className="w-4 h-4" />
            <span>{t('ডিজিটাল টুইন ড্যাশবোর্ড খুলুন', 'Open Digital Twin')}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SYSTEM INTEGRITY & PLATFORM AUDIT TILES
          ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        
        {/* Tile 1: 7 AI Models Status */}
        <div className="rounded-2xl p-4 sm:p-5 bg-forest-900/60 border border-forest-800/80 text-cream-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bengali text-xs font-bold text-cream-100">
                {t('৭টি এআই মডেল সক্রিয়', '7 AI Models Loaded')}
              </p>
              <p className="text-[11px] text-sage-400 font-mono">
                {health?.models_count || 7} Verified Checkpoints
              </p>
            </div>
          </div>
          <p className="font-bengali text-xs text-sage-300 leading-relaxed">
            {t(
              'ভিশন, সয়েল এনপিকে, রিজিয়নাল ইয়েল্ড, হাইড্রোলজি ও প্রাইস মডেলের সকল চেকসাম SHA-256 দ্বারা যাচাইকৃত।',
              'Vision, Soil NPK, Yield, Flood and Price models verified against manifest checksums.'
            )}
          </p>
        </div>

        {/* Tile 2: Advisory Mode */}
        <div className="rounded-2xl p-4 sm:p-5 bg-forest-900/60 border border-forest-800/80 text-cream-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center text-gold-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bengali text-xs font-bold text-cream-100">
                {t('লোকাল এগ্রোনমিক ইঞ্জিন', 'Local Agronomic Engine')}
              </p>
              <p className="text-[11px] text-sage-400 font-mono">
                Rule-Based Offline Safe
              </p>
            </div>
          </div>
          <p className="font-bengali text-xs text-sage-300 leading-relaxed">
            {t(
              'তথ্য ও পরামর্শ স্থানীয় নির্ভুল কৃষি ডাটাবেস থেকে সরবরাহ করা হয়। কোনো মনগড়া বা ভুয়া তথ্য তৈরি করা হয় না।',
              'Advisory responses are grounded in verified agronomic rules without hallucinated outputs.'
            )}
          </p>
        </div>

        {/* Tile 3: Audit Records */}
        <div className="rounded-2xl p-4 sm:p-5 bg-forest-900/60 border border-forest-800/80 text-cream-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bengali text-xs font-bold text-cream-100">
                {t('প্রেডিকশন ইতিহাস ও অডিট', 'Audit Trail & Records')}
              </p>
              <p className="text-[11px] text-sage-400 font-mono">
                {historyCount} Saved Executions
              </p>
            </div>
          </div>
          <p className="font-bengali text-xs text-sage-300 leading-relaxed">
            {t(
              'আপনার প্রতিটি মডেল প্রেডিকশনের ইনপুট, ফলাফল ও সময় সুরক্ষিত ডাটাবেসে সংরক্ষিত রয়েছে।',
              'Every model prediction input, result, and timestamp is safely stored in your account database.'
            )}
          </p>
        </div>

      </div>

    </div>
  );
}
