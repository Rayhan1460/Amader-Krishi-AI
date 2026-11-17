import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CloudSun,
  ImagePlus,
  Leaf,
  MapPin,
  Mic,
  MicOff,
  ScanLine,
  Send,
  ShieldCheck,
  Sprout,
  TrendingUp,
} from 'lucide-react';
import './NewChatWelcome.css';

const translations = {
  bn: {
    eyebrow: 'মাটি থেকে বাজার — এক AI সিস্টেম',
    titleOne: 'আসসালামু আলাইকুম',
    titleTwo: 'আমি আমাদের কৃষি AI। আপনার জমি,',
    titleThree: 'ফসল, মাটি বা বাজার নিয়ে বলুন।',
    subtitle: 'আপনার কৃষিকাজে সহজ ভাষায় তথ্য ও সিদ্ধান্ত-সহায়তা',
    soil: 'মাটির স্বাস্থ্য',
    soilText: 'মাটির পরীক্ষার তথ্য',
    risk: 'আবহাওয়া ও ঝুঁকি',
    riskText: 'ঝুঁকির তথ্য দেখুন',
    crop: 'ফসলের পরামর্শ',
    cropText: 'ফসল নির্বাচন করুন',
    market: 'বাজার দর',
    marketText: 'দাম ও বিশ্লেষণ দেখুন',
    farmAction: 'আমার জমি বিশ্লেষণ',
    cropAction: 'ফসলের পরামর্শ',
    scanAction: 'পাতার রোগ স্ক্যান',
    priceAction: 'বাজার দর দেখুন',
    prompt: 'আপনার জমি বা ফসল নিয়ে প্রশ্ন করুন…',
    microphone: 'কথা বলে প্রশ্ন করুন',
    microphoneStop: 'শোনা বন্ধ করুন',
    scan: 'রোগ শনাক্তের জন্য ছবি স্ক্যান করুন',
    send: 'প্রশ্ন পাঠান',
    listening: 'শুনছি… প্রশ্ন বলুন',
    unsupported: 'এই ব্রাউজারে ভয়েস ইনপুট নেই। লিখে প্রশ্ন করতে পারবেন।',
    listenError: 'ভয়েস ইনপুট শুরু করা যায়নি। লিখে প্রশ্ন করুন।',
    dataNote: 'এগুলো তথ্য দেখার শর্টকাট, কোনো কাল্পনিক ফলাফল নয়।',
    quickLabel: 'দ্রুত সেবা',
  },
  en: {
    eyebrow: 'FROM SOIL TO MARKET — ONE AI SYSTEM',
    titleOne: 'Assalamu Alaikum',
    titleTwo: "I'm Amader Krishi AI. Tell me about",
    titleThree: 'your farm, crops, soil or market.',
    subtitle: 'Simple agricultural guidance and decision support',
    soil: 'Soil health',
    soilText: 'View soil test records',
    risk: 'Weather & risk',
    riskText: 'View risk information',
    crop: 'Crop advice',
    cropText: 'Explore crop choices',
    market: 'Market prices',
    marketText: 'See price information',
    farmAction: 'Analyze my farm',
    cropAction: 'Crop advice',
    scanAction: 'Scan leaf disease',
    priceAction: 'Check market prices',
    prompt: 'Ask anything about your farm…',
    microphone: 'Ask with your voice',
    microphoneStop: 'Stop listening',
    scan: 'Open the leaf-scanning tool',
    send: 'Send message',
    listening: 'Listening… speak now',
    unsupported: 'Voice input is not available in this browser. Please type your question.',
    listenError: 'Voice input could not start. Please type your question.',
    dataNote: 'Quick links to your tools, not made-up measurements.',
    quickLabel: 'Quick actions',
  },
};

/**
 * Visual-only replacement for the chat welcome page.
 * Chat persistence remains with WorkspacePage / ChatView / existing chatApi.
 */
export default function NewChatWelcome({ lang = 'bn', onSend, onNavigateToTab, isSending = false }) {
  const t = translations[lang === 'en' ? 'en' : 'bn'];
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 108)}px`;
  }, [draft]);

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.stop();
    }
  }, []);

  const go = (tab, modelId) => {
    if (typeof onNavigateToTab === 'function') {
      onNavigateToTab(tab, modelId);
    }
  };

  const send = () => {
    const message = draft.trim();
    if (!message || isSending || typeof onSend !== 'function') return;
    setDraft('');
    onSend(message);
  };

  const toggleVoice = () => {
    setVoiceError('');
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(t.unsupported);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang === 'en' ? 'en-US' : 'bn-BD';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ');
        setDraft(transcript);
      };
      recognition.onend = () => setListening(false);
      recognition.onerror = () => {
        setListening(false);
        setVoiceError(t.listenError);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setVoiceError(t.listenError);
    }
  };

  const insightLinks = [
    { icon: Leaf, title: t.soil, subtitle: t.soilText, action: () => go('soil_health') },
    { icon: CloudSun, title: t.risk, subtitle: t.riskText, action: () => go('tools', 'flood_susceptibility') },
    { icon: Sprout, title: t.crop, subtitle: t.cropText, action: () => go('tools', 'crop_recommendation') },
    { icon: TrendingUp, title: t.market, subtitle: t.marketText, action: () => go('tools', 'tomato_price') },
  ];

  const quickLinks = [
    { icon: MapPin, title: t.farmAction, action: () => go('smart_center') },
    { icon: Sprout, title: t.cropAction, action: () => go('tools', 'crop_recommendation') },
    { icon: ScanLine, title: t.scanAction, action: () => go('tools', 'tomato_disease_v3') },
    { icon: TrendingUp, title: t.priceAction, action: () => go('tools', 'tomato_price') },
  ];

  return (
    <div className="nc-root">
      <div className="nc-content">
        <section className="nc-hero" aria-label={t.subtitle}>
          <div className="nc-hero-shade" aria-hidden="true" />
          <div className="nc-hero-center">
            <div className="nc-eyebrow"><span className="nc-eyebrow-dot" />{t.eyebrow}</div>
            <span className="nc-gold-rule" aria-hidden="true" />
            <h1 className="nc-headline">
              <span>{t.titleOne} <span aria-hidden="true">👋</span></span>
              <span>{t.titleTwo}</span>
              <span>{t.titleThree}</span>
            </h1>
            <p className="nc-tagline"><Bot size={17} aria-hidden="true" />{t.subtitle}</p>
          </div>

          <div className="nc-insights" aria-label={t.quickLabel}>
            {insightLinks.map((item) => (
              <button type="button" className="nc-insight" key={item.title} onClick={item.action}>
                <span className="nc-insight-name"><item.icon size={16} aria-hidden="true" />{item.title}</span>
                <span className="nc-insight-description">{item.subtitle}</span>
                <ArrowRight className="nc-insight-arrow" size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        <div className="nc-quick-actions" aria-label={t.quickLabel}>
          {quickLinks.map((item) => (
            <button type="button" className="nc-quick" key={item.title} onClick={item.action}>
              <item.icon size={17} aria-hidden="true" />
              <span>{item.title}</span>
            </button>
          ))}
        </div>

        <form className="nc-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <div className="nc-compose-left">
            <button type="button" className={`nc-circle ${listening ? 'nc-circle-active' : ''}`}
              onClick={toggleVoice} aria-label={listening ? t.microphoneStop : t.microphone}
              title={listening ? t.microphoneStop : t.microphone}>
              {listening ? <MicOff size={21} /> : <Mic size={21} />}
            </button>
            <button type="button" className="nc-circle" onClick={() => go('tools', 'tomato_disease_v3')}
              aria-label={t.scan} title={t.scan}>
              <ImagePlus size={21} />
            </button>
          </div>
          <textarea ref={textareaRef} rows={1} value={draft} disabled={isSending}
            placeholder={listening ? t.listening : t.prompt}
            aria-label={t.prompt}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }} />
          <button type="submit" className="nc-submit" disabled={isSending || !draft.trim()}
            title={t.send} aria-label={t.send}>
            <Send size={22} aria-hidden="true" />
          </button>
        </form>
        {voiceError && <p className="nc-feedback" role="status">{voiceError}</p>}
        <p className="nc-note"><ShieldCheck size={13} aria-hidden="true" />{t.dataNote}</p>
      </div>
    </div>
  );
}
