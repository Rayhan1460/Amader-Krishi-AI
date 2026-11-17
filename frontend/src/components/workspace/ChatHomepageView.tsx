import { useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Send,
  Mic,
  Image as ImageIcon,
  TestTube,
  CloudRain,
  Sprout,
  Coins,
  X,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { WorkspaceTab } from './WorkspaceSidebar.tsx';

interface ChatHomepageViewProps {
  onNavigateToTab: (tab: WorkspaceTab, modelId?: string) => void;
  onSendMessage: (content: string) => Promise<void> | void;
  isSending?: boolean;
}

export function ChatHomepageView({
  onNavigateToTab,
  onSendMessage,
  isSending = false,
}: ChatHomepageViewProps) {
  const { lang } = useLanguage();
  const [inputMessage, setInputMessage] = useState('');
  const [showMicModal, setShowMicModal] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const query = inputMessage.trim();
    if (!query || isSending) return;
    setInputMessage('');
    onSendMessage(query);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCardClick = (prompt: string) => {
    setInputMessage(prompt);
    // Submit query directly
    onSendMessage(prompt);
  };

  // 4 Suggestion Cards matching 01_chat_home_reference.png
  const suggestionCards = [
    {
      id: 'soil_health',
      icon: TestTube,
      iconColor: 'text-emerald-400',
      title: lang === 'bn' ? 'মাটির স্বাস্থ্য' : 'Soil Health',
      value: lang === 'bn' ? 'ডেটা খুলুন' : 'Open dashboard',
      status: lang === 'bn' ? 'মাটি ও পুষ্টি' : 'Soil & nutrients',
      desc: lang === 'bn' ? 'নির্বাচিত খামারের মাটি বিশ্লেষণ' : 'Analyze the selected farm soil',
      prompt: lang === 'bn'
        ? 'আমার জমির মাটির স্বাস্থ্য ও সার প্রয়োগের সঠিক নিয়ম কী?'
        : 'What is the recommended fertilizer plan for my soil health?',
      tab: 'soil_health' as WorkspaceTab,
      modelId: undefined,
    },
    {
      id: 'rain_risk',
      icon: CloudRain,
      iconColor: 'text-sky-400',
      title: lang === 'bn' ? 'বৃষ্টির ঝুঁকি' : 'Rain Risk',
      value: lang === 'bn' ? 'ঝুঁকি দেখুন' : 'View risk',
      status: lang === 'bn' ? 'আবহাওয়া' : 'Weather',
      desc: lang === 'bn' ? 'আবহাওয়া ও বন্যা ঝুঁকি পর্যালোচনা' : 'Review weather and flood risk',
      prompt: lang === 'bn'
        ? 'আগামী ৭ দিনে আমার এলাকায় কি কোনো অতিবৃষ্টি বা বন্যার ঝুঁকি আছে?'
        : 'Are there any heavy rain or flood risks in my area in the next 7 days?',
      tab: 'tools' as WorkspaceTab,
      modelId: 'flood_susceptibility',
    },
    {
      id: 'crop_match',
      icon: Sprout,
      iconColor: 'text-amber-400',
      title: lang === 'bn' ? 'ফসল ম্যাচ' : 'Crop Match',
      value: lang === 'bn' ? 'ফসল বেছে নিন' : 'Choose a crop',
      status: lang === 'bn' ? 'সুপারিশ' : 'Recommendation',
      desc: lang === 'bn' ? 'খামারের শর্ত অনুযায়ী ফসল উপদেষ্টা' : 'Crop advisor based on farm conditions',
      prompt: lang === 'bn'
        ? 'আমার মাটির এনপিকে এবং আবহাওয়ার জন্য সবচেয়ে লাভজনক ফসল কোনটি?'
        : 'Which crop offers the highest yield based on my soil NPK and weather?',
      tab: 'tools' as WorkspaceTab,
      modelId: 'crop_recommendation',
    },
    {
      id: 'market_price',
      icon: Coins,
      iconColor: 'text-[#e9ad46]',
      title: lang === 'bn' ? 'ঐতিহাসিক বাজার দর' : 'Historical market price',
      value: lang === 'bn' ? 'তথ্য যাচাই করুন' : 'Explore records',
      status: lang === 'bn' ? 'ঐতিহাসিক' : 'Historical',
      desc: lang === 'bn' ? 'সাম্প্রতিক নয়—পূর্ববর্তী পাইকারি দর গবেষণা' : 'Prior wholesale prices, not live quotes',
      prompt: lang === 'bn'
        ? 'বর্তমান কাওরান বাজার ও পাইকারি বাজারে টমেটো ও ধানের সাম্প্রতিক দর কেমন?'
        : 'What are the latest wholesale market prices for tomato and rice?',
      tab: 'tools' as WorkspaceTab,
      modelId: 'tomato_price',
    },
  ];

  // Quick Action Prompt Pills matching reference
  const promptPills = [
    {
      emoji: '🌱',
      label: lang === 'bn' ? 'আমার খামার বিশ্লেষণ' : 'Analyze My Farm',
      query: lang === 'bn'
        ? 'আমার খামারের বর্তমান অবস্থা, ফসল ও পরবর্তী করণীয় কাজগুলো বিশ্লেষণ করুন।'
        : 'Analyze my farm overview, current crops, and upcoming tasks.',
    },
    {
      emoji: '🌾',
      label: lang === 'bn' ? 'ফসলের পরামর্শ' : 'Crop Advice',
      query: lang === 'bn'
        ? 'বর্তমান মৌসুমে অধিক ফলনের জন্য কোন সার ও পরিচর্যা প্রয়োজন?'
        : 'What fertilizer and agronomic practices maximize crop yield this season?',
    },
    {
      emoji: '📷',
      label: lang === 'bn' ? 'পাতা রোগ স্ক্যান' : 'Scan Leaf Disease',
      query: lang === 'bn'
        ? 'টমেটো বা ধানের পাতার রোগ শনাক্তকরণ এবং লক্ষণ নির্ণয় করতে চাই।'
        : 'How do I identify fungal or bacterial leaf spots on tomato or rice crops?',
    },
    {
      emoji: '💰',
      label: lang === 'bn' ? 'বাজার দর জানুন' : 'Check Market Price',
      query: lang === 'bn'
        ? 'টমেটো ও বোরো ধানের পাইকারি বাজারদর ও মূল্য পূর্বাভাস জানতে চাই।'
        : 'What are the current market trends and wholesale prices for tomato and boro rice?',
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
      
      {/* 1. Large Scenic Agricultural Hero Section */}
      <div className="relative w-full overflow-hidden flex-1 flex flex-col justify-center items-center text-center px-4 pt-8 pb-4">
        
        {/* Background Visual: Atmospheric Sunset Agricultural Landscape Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
          style={{
            background: `
              radial-gradient(ellipse at 50% 28%, rgba(233, 173, 70, 0.28) 0%, rgba(39, 110, 77, 0.2) 35%, transparent 70%),
              radial-gradient(ellipse at 50% 100%, rgba(0, 28, 18, 0.95) 0%, rgba(0, 28, 18, 1) 100%),
              linear-gradient(180deg, rgba(8, 43, 31, 0.45) 0%, rgba(0, 28, 18, 0.8) 50%, #001c12 95%)
            `,
          }}
        >
          <img
            src="/bogra-fields.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity"
          />
          {/* Subtle Agricultural Crop Rows & Horizon Perspective SVG */}
          <svg
            className="w-full h-full object-cover opacity-25"
            preserveAspectRatio="none"
            viewBox="0 0 1440 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Horizon Glow Sun */}
            <circle cx="720" cy="220" r="160" fill="url(#hero_sun_glow)" />
            {/* Distant Trees & Green Contours */}
            <path
              d="M0 260Q360 230 720 245T1440 260V600H0Z"
              fill="#062519"
              opacity="0.8"
            />
            {/* Perspective Furrows / Crop Rows running to horizon */}
            <g stroke="#1b4d38" strokeWidth="1.5" opacity="0.6">
              <line x1="720" y1="245" x2="0" y2="600" />
              <line x1="720" y1="245" x2="140" y2="600" />
              <line x1="720" y1="245" x2="280" y2="600" />
              <line x1="720" y1="245" x2="420" y2="600" />
              <line x1="720" y1="245" x2="560" y2="600" />
              <line x1="720" y1="245" x2="700" y2="600" />
              <line x1="720" y1="245" x2="740" y2="600" />
              <line x1="720" y1="245" x2="880" y2="600" />
              <line x1="720" y1="245" x2="1020" y2="600" />
              <line x1="720" y1="245" x2="1160" y2="600" />
              <line x1="720" y1="245" x2="1300" y2="600" />
              <line x1="720" y1="245" x2="1440" y2="600" />
            </g>
            {/* Sun Glow Gradient */}
            <defs>
              <radialGradient id="hero_sun_glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(720 220) scale(160)">
                <stop stopColor="#e9ad46" stopOpacity="0.4" />
                <stop offset="0.6" stopColor="#e9ad46" stopOpacity="0.1" />
                <stop offset="1" stopColor="#001c12" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        {/* Hero Content Container */}
        <div className="relative z-10 max-w-4xl mx-auto w-full krishi-reveal">
          <img
            src="/amader_krishi_OFFICIAL_LOGO.png"
            alt="আমাদের কৃষি"
            className="mx-auto mb-3 w-[150px] sm:w-[190px] h-auto max-h-[118px] object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
          />
          
          {/* Eyebrow Heading with Gold Divider Accent */}
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#e9ad46]">
              FROM SOIL TO MARKET — ONE AI SYSTEM
            </span>
          </div>

          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#e9ad46] to-transparent mx-auto mb-6" />

          {/* Large Welcoming Title */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-[#f8fbf7] tracking-tight leading-tight max-w-3xl mx-auto mb-3">
            {lang === 'bn' ? (
              <>
                আসসালামু আলাইকুম! 🌱 <br />
                <span className="text-cream-100 font-semibold text-xl sm:text-2xl lg:text-3xl block mt-2">
                  আমি আমাদের কৃষি AI। আপনার খামার, ফসল, মাটি বা বাজার সম্পর্কে বলুন।
                </span>
              </>
            ) : (
              <>
                Assalamu Alaikum 👋 <br />
                <span className="text-cream-100 font-semibold text-xl sm:text-2xl lg:text-3xl block mt-2">
                  I am Amader Krishi AI. Tell me about your farm, crop, soil, or market.
                </span>
              </>
            )}
          </h1>

          <p className="text-xs sm:text-sm text-[#a7b9ae] max-w-xl mx-auto mt-2 mb-8 leading-relaxed">
            {lang === 'bn'
              ? 'বাংলাদেশের কৃষকদের জন্য নির্ভরযোগ্য বাস্তব তথ্য, আবহাওয়া সতর্কতা ও সঠিক কৃষি সিদ্ধান্তের স্মার্ট প্ল্যাটফর্ম।'
              : 'Reliable agronomic intelligence, weather risks, and validated farm decisions for Bangladesh.'}
          </p>

          {/* 4 Suggestion Cards (Desktop 4-col, Mobile 2x2 grid) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto text-left mb-6">
            {suggestionCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onNavigateToTab(card.tab, card.modelId)}
                  className="krishi-card-glass rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between group cursor-pointer text-left w-full focus:outline-none focus:ring-1 focus:ring-[#e9ad46]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#a7b9ae] flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                      {card.title}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded-md">
                      {card.status}
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-extrabold text-[#f8fbf7] group-hover:text-[#e9ad46] transition-colors">
                    {card.value}
                  </div>
                  <div className="text-[11px] text-[#a7b9ae]/80 truncate mt-1">
                    {card.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Action Prompt Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto mb-4">
            {promptPills.map((pill, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleCardClick(pill.query)}
                className="krishi-prompt-pill px-3.5 py-2 rounded-full text-xs font-medium inline-flex items-center gap-2 cursor-pointer focus:outline-none"
              >
                <span>{pill.emoji}</span>
                <span>{pill.label}</span>
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* 2. Large Bottom-Aligned Floating Chat Input */}
      <div className="sticky bottom-0 z-30 w-full px-4 pb-6 pt-2 bg-gradient-to-t from-[#001c12] via-[#001c12]/95 to-transparent">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto w-full krishi-input-glass rounded-full p-1.5 sm:p-2 flex items-center gap-2"
        >
          {/* Microphone Button */}
          <button
            type="button"
            onClick={() => setShowMicModal(true)}
            className="w-10 h-10 rounded-full bg-[#153f2e]/80 hover:bg-[#153f2e] text-emerald-300 hover:text-emerald-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer focus:outline-none"
            title={lang === 'bn' ? 'ভয়েস ইনপুট' : 'Voice Input'}
            aria-label="Voice input"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Image Attachment Button */}
          <button
            type="button"
            onClick={() => setShowAttachmentModal(true)}
            className="w-10 h-10 rounded-full bg-[#153f2e]/80 hover:bg-[#153f2e] text-emerald-300 hover:text-emerald-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer focus:outline-none"
            title={lang === 'bn' ? 'পাতার ছবি আপলোড ও রোগ নির্ণয়' : 'Upload leaf image for disease diagnosis'}
            aria-label="Upload leaf image"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            placeholder={
              lang === 'bn'
                ? 'আপনার খামার, ফসল বা মাটি সম্পর্কে যেকোনো প্রশ্ন করুন...'
                : 'Ask anything about your farm, crop, soil, or market...'
            }
            className="flex-1 bg-transparent border-0 text-[#f8fbf7] placeholder-[#a7b9ae]/60 text-sm sm:text-base px-2 sm:px-3 focus:outline-none"
          />

          {/* Gold Send Button */}
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full krishi-gold-btn flex items-center justify-center shrink-0 cursor-pointer focus:outline-none shadow-md"
            title={lang === 'bn' ? 'বার্তা পাঠান' : 'Send message'}
            aria-label="Send message"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4 ml-0.5" />
            )}
          </button>
        </form>

        <p className="text-[11px] text-center text-[#a7b9ae]/60 mt-2">
          {lang === 'bn'
            ? 'আমাদের কৃষি AI বৈজ্ঞানিক ডেটা ও অনুমোদিত মডেল দ্বারা পরিচালিত। গুরুত্বপূর্ণ সিদ্ধান্তের পূর্বে আঞ্চলিক কৃষি কর্মকর্তার পরামর্শ নিন।'
            : 'Amader Krishi AI operates on validated research models. Consult local extension officers for critical farm decisions.'}
        </p>
      </div>

      {/* Voice Input Information Modal */}
      {showMicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#082b1f] border border-[#224b39] rounded-2xl p-6 max-w-md w-full shadow-2xl krishi-reveal text-left">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#224b39]">
              <div className="flex items-center gap-2 text-[#e9ad46] font-bold">
                <Mic className="w-5 h-5" />
                <span>{lang === 'bn' ? 'ভয়েস ইনপুট ফিচার' : 'Voice Input Feature'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMicModal(false)}
                className="text-[#a7b9ae] hover:text-[#f8fbf7] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#f8fbf7] leading-relaxed mb-4">
              {lang === 'bn'
                ? 'বাংলা语音 ইনপুট ফিচারটি বর্তমানে অপটিমাইজেশন প্রক্রিয়ায় রয়েছে। আপনি সরাসরি নিচের বক্সে বাংলা বা ইংরেজিতে টাইপ করে প্রশ্ন করতে পারেন।'
                : 'Bengali speech recognition is currently in optimization mode. Please type your query in Bangla or English in the input field.'}
            </p>
            <div className="bg-[#0b3325] border border-[#224b39] rounded-xl p-3 mb-4 text-xs text-[#a7b9ae]">
              <span className="font-semibold text-emerald-400">💡 {lang === 'bn' ? 'টিপ্স:' : 'Tip:'}</span>{' '}
              {lang === 'bn'
                ? 'কিবোর্ডের ভয়েস টাইপিং (যেমন Gboard স্পিচ) ব্যবহার করে আপনি সরাসরি বাংলায় বলতে পারেন।'
                : 'You can use your device OS voice keyboard (e.g. Gboard) to speak directly in Bengali.'}
            </div>
            <button
              type="button"
              onClick={() => setShowMicModal(false)}
              className="w-full py-2.5 rounded-xl krishi-gold-btn font-semibold text-sm cursor-pointer"
            >
              {lang === 'bn' ? 'ঠিক আছে' : 'Got it'}
            </button>
          </div>
        </div>
      )}

      {/* Image Attachment & Plant Diagnosis Modal */}
      {showAttachmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#082b1f] border border-[#224b39] rounded-2xl p-6 max-w-md w-full shadow-2xl krishi-reveal text-left">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#224b39]">
              <div className="flex items-center gap-2 text-[#e9ad46] font-bold">
                <ImageIcon className="w-5 h-5" />
                <span>{lang === 'bn' ? 'পাতা রোগ স্ক্যান নির্দেশিকা' : 'Leaf Disease Vision Scan'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAttachmentModal(false)}
                className="text-[#a7b9ae] hover:text-[#f8fbf7] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#f8fbf7] leading-relaxed mb-3">
              {lang === 'bn'
                ? 'আমাদের সিস্টেমে টমেটো এবং ধানের পাতার রোগ শনাক্তকরণের জন্য ২টি প্রশিক্ষিত ডিপ লার্নিং ভিশন মডেল সক্রিয় রয়েছে:'
                : 'Our platform includes 2 trained deep learning vision models for foliar disease classification:'}
            </p>
            <ul className="space-y-2 mb-4 text-xs text-[#a7b9ae]">
              <li className="flex items-start gap-2 bg-[#0b3325] p-2.5 rounded-xl border border-[#224b39]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#f8fbf7]">{lang === 'bn' ? 'টমেটো পাতা রোগ:' : 'Tomato Disease:'}</strong>{' '}
                  {lang === 'bn' ? 'আর্লি ব্লাইট, লেইট ব্লাইট, ব্যাকটেরিয়াল স্পট ইত্যাদি ৮টি ক্লাস।' : '8 classes including early & late blight.'}
                </span>
              </li>
              <li className="flex items-start gap-2 bg-[#0b3325] p-2.5 rounded-xl border border-[#224b39]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#f8fbf7]">{lang === 'bn' ? 'ধানের পাতা রোগ:' : 'Rice Disease:'}</strong>{' '}
                  {lang === 'bn' ? 'ব্লাস্ট, টুংরো, লিফ স্কাল্ড ইত্যাদি ৭টি ক্লাস।' : '7 foliar conditions.'}
                </span>
              </li>
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentModal(false);
                  onNavigateToTab('crop_monitoring');
                }}
                className="flex-1 py-2.5 rounded-xl krishi-gold-btn font-semibold text-xs text-center cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>{lang === 'bn' ? 'ফসল পর্যবেক্ষণ ও স্ক্যানারে যান' : 'Go to Crop Monitoring'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowAttachmentModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#153f2e] text-[#f8fbf7] hover:bg-[#1b4d38] font-medium text-xs cursor-pointer"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ChatHomepageView;
