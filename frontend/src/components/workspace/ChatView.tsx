import { useEffect, useRef, useState } from 'react';
import type { Dispatch, FormEvent, KeyboardEvent, MouseEvent, SetStateAction } from 'react';
import {
  Wheat, MessageSquare, Ellipsis, Copy, ThumbsUp, ThumbsDown, Volume2, VolumeX,
  Share, Image as ImageIcon, Send, PanelLeft, X, Download,
  Apple, SquareCheck, ArrowLeft, LoaderCircle, Cpu, Droplet, Layers, CloudSun,
  ArrowUpRight, Mic, Square,
} from 'lucide-react';
import { api, chatApi, getErrorMessage } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ChatMessage, ChatSession } from '../../types/index.ts';
import { useChatVoice } from './useChatVoice.ts';
import './PremiumChat.css';

export interface ChatEntry {
  content: string;
}

interface ChatViewProps {
  sessions: ChatSession[];
  onSessionsChange: Dispatch<SetStateAction<ChatSession[]>>;
  activeSessionId: number | null;
  onActiveSessionChange: (id: number | null) => void;
  onSelectModelTool: (modelId: string) => void;
  entry: ChatEntry | null;
  onEntryHandled: () => void;
  onOpenSidebar: () => void;
  sidebarOpen: boolean;
  loading: boolean;
  working: boolean;
  onWorkingChange: (working: boolean) => void;
  sessionExpired: boolean;
  onSessionError: (error: unknown) => boolean;
  onSignIn: () => void;
}

type Rating = 'up' | 'down';
type ToolInvocation = { tool: string; result?: { caveat?: string } };

const MAX_MESSAGE_LENGTH = 4000;
const BRAND = 'আমাদের কৃষি AI';
const ENGLISH_BRAND = 'Amader Krishi AI';

function upsert(sessions: ChatSession[], session: ChatSession) {
  if (sessions.some((item) => item.id === session.id)) {
    return sessions.map((item) => item.id === session.id ? session : item);
  }
  return [session, ...sessions];
}

function messagesAfterGreeting(messages: ChatMessage[]) {
  const first = messages[0];
  // The API creates a welcome message without provider metadata.
  return first?.role === 'assistant' && !first.provider && first.content.startsWith('Hello ')
    && first.content.includes('Welcome to AgriSphere AI')
    ? messages.slice(1)
    : messages;
}

function plainText(content: string) {
  return content
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*(?:---+|\*\*\*+)\s*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*(.+?)\*\*|\*(.+?)\*|\x60([^\x60]+)\x60/g, (_, bold, italic, code) => bold ?? italic ?? code)
    .trim();
}

function inlineText(text: string) {
  return text.split(/(\*\*.+?\*\*|\*[^*]+\*|\x60[^\x60]+\x60)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.charCodeAt(0) === 96 && part.charCodeAt(part.length - 1) === 96 && part.length > 2) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function AnswerText({ content }: { content: string }) {
  const lines = content.split('\n');
  return lines.map((line, index) => {
    const text = line.trim();
    if (!text || /^(---+|\*\*\*+)$/.test(text)) return null;
    const heading = /^#{1,6}\s+(.+)$/.exec(text);
    if (heading) return <h3 key={index}>{inlineText(heading[1])}</h3>;
    const bullet = /^(?:[•*-]|\d+[.)])\s+(.+)$/.exec(text);
    if (bullet) {
      return (
        <div className="ag-chat-checkline" key={index}>
          <SquareCheck aria-hidden="true" />
          <span>{inlineText(bullet[1])}</span>
        </div>
      );
    }
    return <p key={index}>{inlineText(text)}</p>;
  });
}

function ratingStorage(userId: number, key: string) {
  return `amader-krishi-chat-rating:${userId}:${key}`;
}

export function ChatView({
  sessions, onSessionsChange, activeSessionId, onActiveSessionChange,
  onSelectModelTool, entry, onEntryHandled, onOpenSidebar, sidebarOpen,
  loading, working, onWorkingChange, sessionExpired, onSessionError, onSignIn,
}: ChatViewProps) {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const brand = t(BRAND, ENGLISH_BRAND);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const draftKey = activeSessionId ?? 'new';

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState('');
  const [notice, setNotice] = useState('');
  const [incoming, setIncoming] = useState<ChatMessage | null>(null);
  const [welcomeVersion, setWelcomeVersion] = useState(0);
  const [ratings, setRatings] = useState<Record<string, Rating | null>>({});
  const [pending, setPending] = useState<{ session: number | null; message: ChatMessage } | null>(null);

  const busy = useRef(false);
  const handledEntry = useRef<ChatEntry | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);
  const lastSession = useRef<number | null>(null);
  const followLatest = useRef(true);

  const input = drafts[draftKey] ?? '';
  const visibleMessages = messagesAfterGreeting(activeSession?.messages ?? []);
  const pendingMessage = pending && pending.session === activeSessionId ? pending.message : null;
  const shownTitle = activeSession?.title || t('নতুন চ্যাট', 'New chat');

  useEffect(() => {
    const box = transcript.current;
    const switched = lastSession.current !== activeSessionId;
    lastSession.current = activeSessionId;
    if (box && (switched || followLatest.current)) {
      followLatest.current = true;
      box.scrollTop = box.scrollHeight;
    }
  }, [activeSessionId, activeSession?.messages, pendingMessage]);

  useEffect(() => {
    function closeOtherMenus(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      const target = event.target;
      const menus = layoutRef.current?.querySelectorAll<HTMLDetailsElement>('.ag-chat-menu[open]');
      menus?.forEach((menu) => { if (!menu.contains(target)) menu.open = false; });
    }
    document.addEventListener('pointerdown', closeOtherMenus);
    return () => document.removeEventListener('pointerdown', closeOtherMenus);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const voice = useChatVoice({
    session: activeSessionId,
    sessionExpired,
    defaultLanguage: lang === 'bn' ? 'bn' : 'en',
    t,
    notify: setNotice,
    onSessionError,
    onDictation: (text) => {
      if (!text) return;
      setDrafts((items) => {
        const draft = items[draftKey]?.trimEnd();
        return { ...items, [draftKey]: [draft, text].filter(Boolean).join(' ').slice(0, MAX_MESSAGE_LENGTH) };
      });
      composer.current?.focus();
    },
  });

  useEffect(() => {
    if (!busy.current) setSendError('');
  }, [activeSessionId]);

  function setDraft(value: string) {
    setDrafts((items) => ({ ...items, [draftKey]: value }));
  }

  async function sendMessage(text: string, selectedId = activeSessionId) {
    const content = text.trim();
    if (!content || busy.current || working || loading || sessionExpired || voice.voiceStage) return;
    if (content.length > MAX_MESSAGE_LENGTH) {
      setSendError(t('প্রশ্নটি ৪,০০০ অক্ষরের মধ্যে লিখুন।', 'Write a question of up to 4,000 characters.'));
      return;
    }

    busy.current = true;
    onWorkingChange(true);
    followLatest.current = true;
    setSendError('');
    const originalId = selectedId ?? 'new';
    const question: ChatMessage = { role: 'user', content, timestamp: new Date().toISOString() };
    let targetId = selectedId;
    let previousUserMessages = targetId === null
      ? 0
      : (sessions.find((session) => session.id === targetId)?.messages ?? []).filter((message) => message.role === 'user').length;

    setDrafts((items) => ({ ...items, [originalId]: '' }));
    setPending({ session: targetId, message: question });
    try {
      if (targetId === null) {
        const title = Array.from(content.replace(/\s+/g, ' ')).slice(0, 52).join('');
        const created = await chatApi.createSession(title);
        targetId = created.id;
        previousUserMessages = created.messages.filter((message) => message.role === 'user').length;
        onSessionsChange((items) => upsert(items, created));
        setDrafts((items) => ({ ...items, [created.id]: items.new ?? '', new: '' }));
        onActiveSessionChange(created.id);
        setPending({ session: created.id, message: question });
      }
      const { data: updated } = await api.post<ChatSession>(
        `/chat/sessions/${targetId}/messages`,
        { content },
        { timeout: 60_000 },
      );
      onSessionsChange((items) => upsert(items, updated));
      setIncoming(updated.messages.at(-1) ?? null);
    } catch (error) {
      let saved = false;
      const expired = onSessionError(error);
      if (targetId !== null && !expired) {
        try {
          const updated = await chatApi.getSession(targetId);
          onSessionsChange((items) => upsert(items, updated));
          const sentQuestion = updated.messages.filter((message) => message.role === 'user')[previousUserMessages];
          saved = sentQuestion?.content === content;
        } catch { /* Preserve the draft when the session cannot be read. */ }
      }
      if (!saved) {
        const recoveryKey = targetId ?? 'new';
        setDrafts((items) => ({ ...items, [recoveryKey]: content }));
        if (!expired) setSendError(getErrorMessage(error));
      }
    } finally {
      busy.current = false;
      onWorkingChange(false);
      setPending(null);
    }
  }

  useEffect(() => {
    if (!entry || handledEntry.current === entry || loading || working || sessionExpired) return;
    handledEntry.current = entry;
    onEntryHandled();
    void sendMessage(entry.content, null);
    // The entry represents one deliberate submission from the dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, loading, working, sessionExpired]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    event.preventDefault();
    void sendMessage(input);
  }

  async function copyText(content: string, shared = false) {
    try {
      await navigator.clipboard.writeText(content);
      setNotice(shared ? t('শেয়ার করার জন্য কপি হয়েছে', 'Copied for sharing') : t('কপি হয়েছে', 'Copied'));
    } catch {
      setNotice(t('কপি করা যায়নি। লেখাটি নির্বাচন করে কপি করুন।', 'Copy failed. Select the text and copy it.'));
    }
  }

  async function shareText(content: string) {
    const text = plainText(content);
    if (navigator.share && (!navigator.canShare || navigator.canShare({ text }))) {
      try {
        await navigator.share({ title: brand, text });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await copyText(text, true);
  }

  function currentRating(key: string): Rating | null {
    if (key in ratings) return ratings[key];
    try {
      const value = localStorage.getItem(ratingStorage(user?.id ?? 0, key));
      return value === 'up' || value === 'down' ? value : null;
    } catch {
      return null;
    }
  }

  function rate(key: string, rating: Rating) {
    const next = currentRating(key) === rating ? null : rating;
    setRatings((items) => ({ ...items, [key]: next }));
    try {
      const storageKey = ratingStorage(user?.id ?? 0, key);
      if (next) localStorage.setItem(storageKey, next);
      else localStorage.removeItem(storageKey);
    } catch { /* The selection remains available for the current visit. */ }
    setNotice(next ? t('রেটিং দেওয়া হয়েছে', 'Rating saved') : t('রেটিং সরানো হয়েছে', 'Rating removed'));
  }

  function downloadChat(session: ChatSession) {
    const text = messagesAfterGreeting(session.messages)
      .map((message) => `${message.role === 'user' ? t('আপনি', 'You') : brand}\n${plainText(message.content)}`)
      .join('\n\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', session.title, '\n\n', text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `agrisphere-chat-${session.id}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function closeMenu(event: MouseEvent<HTMLButtonElement>) {
    const details = event.currentTarget.closest('details');
    if (details) details.open = false;
  }

  const prompts = [
    { icon: Wheat, label: t('ফসলের স্বাস্থ্য', 'Crop health'), text: t('ধানের পাতা হলুদ হলে প্রথমে কী দেখব?', 'What should I check if rice leaves turn yellow?') },
    { icon: Droplet, label: t('সেচ পরিকল্পনা', 'Irrigation'), text: t('সেচ দেওয়ার সময় ঠিক করতে মাটির কোন লক্ষণগুলো দেখব?', 'What soil signs should I check before irrigating?') },
    { icon: Layers, label: t('মাটির পরীক্ষা', 'Soil testing'), text: t('মাটি পরীক্ষার জন্য নমুনা কীভাবে সংগ্রহ করব?', 'How do I collect a soil sample for testing?') },
    { icon: CloudSun, label: t('আবহাওয়ার প্রস্তুতি', 'Weather preparation'), text: t('ভারী বৃষ্টির আগে ফসল রক্ষায় কী প্রস্তুতি নেব?', 'How can I prepare my crops for heavy rain?') },
  ];

  return (
    <section className="ag-chat-layout" ref={layoutRef} onKeyDown={(event) => {
      if (event.key === 'Escape') {
        layoutRef.current?.querySelectorAll<HTMLDetailsElement>('.ag-chat-menu[open]').forEach((menu) => { menu.open = false; });
        if (voice.voiceStage) voice.cancelRecording();
      }
    }}>
      <div className="ag-chat-main">
        <header className="ag-chat-top">
          <button type="button" className="ag-chat-icon ag-chat-mobile-toggle" aria-controls="krishi-workspace-sidebar"
            aria-expanded={sidebarOpen} aria-label={t('মেনু খুলুন', 'Open menu')} onClick={onOpenSidebar}>
            <PanelLeft aria-hidden="true" />
          </button>
          <MessageSquare className="ag-chat-title-icon" aria-hidden="true" />
          <h1 title={shownTitle}>{shownTitle}</h1>
          <details className="ag-chat-menu ag-chat-top-menu">
            <summary title={t('আরও অপশন', 'More options')} aria-label={t('আরও অপশন', 'More options')}><Ellipsis aria-hidden="true" /></summary>
            <div className="ag-chat-popover">
              {activeSession && (
                <button type="button" onClick={(event) => { downloadChat(activeSession); closeMenu(event); }}>
                  <Download aria-hidden="true" />{t('চ্যাট ডাউনলোড', 'Download chat')}
                </button>
              )}
              <button type="button" disabled={working} onClick={(event) => {
                closeMenu(event);
                voice.cancelRecording();
                voice.stopReading();
                setSendError('');
                setDrafts((items) => ({ ...items, new: '' }));
                onActiveSessionChange(null);
                setWelcomeVersion((value) => value + 1);
                composer.current?.focus();
              }}>
                <MessageSquare aria-hidden="true" />{t('নতুন প্রশ্ন শুরু করুন', 'Start a new conversation')}
              </button>
            </div>
          </details>
        </header>

        <div className="ag-chat-transcript" ref={transcript} aria-label={t('কথোপকথন', 'Conversation')}
          onScroll={(event) => {
            const box = event.currentTarget;
            followLatest.current = box.scrollHeight - box.clientHeight - box.scrollTop < 72;
          }}>
          <div className="ag-chat-reading">
            {!visibleMessages.length && !pendingMessage && (
              <div className="ag-chat-empty" key={welcomeVersion}>
                <div className="ag-chat-welcome">
                  <span className="ag-chat-avatar ag-chat-welcome-avatar"><span className="ag-chat-sprout" aria-hidden="true" /></span>
                  <h2><span>{t('আজ আপনার খামারে', 'What can I help with')}</span><span>{t('কী নিয়ে সাহায্য চাই?', 'on your farm today?')}</span></h2>
                  <p>{t('ফসল, মাটি, সেচ বা আবহাওয়া নিয়ে বাংলায় প্রশ্ন করুন।', 'Ask in your language about crops, soil, irrigation, or weather.')}</p>
                </div>
                <div className="ag-chat-prompts" aria-label={t('প্রশ্নের ধারণা', 'Suggested questions')}>
                  {prompts.map(({ icon: Icon, label, text }) => (
                    <button type="button" key={label} disabled={working || sessionExpired} onClick={() => {
                      setDraft(text);
                      composer.current?.focus();
                    }}>
                      <span className="ag-chat-prompt-icon"><Icon aria-hidden="true" /></span>
                      <span className="ag-chat-prompt-label">{label}</span>
                      <ArrowUpRight className="ag-chat-prompt-arrow" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {[...visibleMessages, ...(pendingMessage ? [pendingMessage] : [])].map((message, index) => {
              const key = `${activeSessionId}:${message.timestamp}:${index}`;
              if (message.role === 'user') return <p className={`ag-chat-user-message${message === pendingMessage ? ' ag-chat-enter' : ''}`} key={key}>{message.content}</p>;
              const vote = currentRating(key);
              const tools = (message.metadata?.tool_invocations ?? []) as ToolInvocation[];
              return (
                <article className={`ag-chat-answer${message === incoming ? ' ag-chat-enter' : ''}`} key={key}>
                  <header className="ag-chat-answer-byline">
                    <span className="ag-chat-avatar"><span className="ag-chat-sprout" aria-hidden="true" /></span>
                    <h2>{brand}</h2>
                  </header>
                  <div className="ag-chat-answer-body">
                    <AnswerText content={message.content} />
                    {Array.isArray(tools) && tools.length > 0 && (
                      <div className="ag-chat-tool-results">
                        {tools.map(({ tool, result }, toolIndex) => (
                          <div key={`${tool}:${toolIndex}`}><Cpu aria-hidden="true" /><span>{t('ব্যবহৃত মডেল', 'Model used')} · {tool}{result?.caveat && <small>{result.caveat}</small>}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ag-chat-answer-actions" role="group" aria-label={t('উত্তরের কাজ', 'Response actions')}>
                    <button type="button" onClick={() => void copyText(plainText(message.content))}><Copy aria-hidden="true" /><span>{t('কপি', 'Copy')}</span></button>
                    <div className="ag-chat-rate" role="group" aria-label={t('রেটিং', 'Rating')}>
                      <button type="button" title={t('সহায়ক', 'Helpful')} aria-label={t('সহায়ক', 'Helpful')} aria-pressed={vote === 'up'} onClick={() => rate(key, 'up')}><ThumbsUp aria-hidden="true" /></button>
                      <button type="button" title={t('সহায়ক হয়নি', 'Not helpful')} aria-label={t('সহায়ক হয়নি', 'Not helpful')} aria-pressed={vote === 'down'} onClick={() => rate(key, 'down')}><ThumbsDown aria-hidden="true" /></button>
                      <span aria-hidden="true">{t('রেটিং', 'Rating')}</span>
                    </div>
                    <button type="button" aria-pressed={voice.speaking === key} onClick={() => voice.readAnswer(key, plainText(message.content.replace(/^\s*(?:[•*-]|\d+[.)])\s+/gm, '')))}>
                      {voice.speaking === key ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
                      <span>{voice.speaking === key ? t('থামান', 'Stop') : t('শুনুন', 'Listen')}</span>
                    </button>
                    <button type="button" onClick={() => void shareText(message.content)}><Share aria-hidden="true" /><span>{t('শেয়ার', 'Share')}</span></button>
                  </div>
                </article>
              );
            })}
            {pendingMessage && <div className="ag-chat-thinking" role="status"><span className="ag-chat-dots" aria-hidden="true"><i /><i /><i /></span>{t('উত্তর তৈরি হচ্ছে…', 'Preparing a reply…')}</div>}
          </div>
        </div>

        <div className="ag-chat-composer-area">
          {sessionExpired && <div className="ag-chat-send-error" role="alert">
            {t('সেশনের মেয়াদ শেষ।', 'Your session has expired.')} <button type="button" onClick={onSignIn}>{t('আবার লগইন করুন', 'Sign in again')}</button>
          </div>}
          {sendError && <div className="ag-chat-send-error" role="alert">{sendError}</div>}
          <audio ref={voice.player} className="ag-chat-voice-player" controls={voice.manualPlayback}
            hidden={!voice.manualPlayback} aria-label={t('উত্তরের অডিও', 'Answer audio')} />
          {voice.voiceStage && (
            <div className="ag-chat-voice-status">
              <span role="status">
                {voice.voiceStage === 'recording' && <span className="ag-chat-recording-dot" aria-hidden="true" />}
                {voice.voiceStage === 'requesting' && t('মাইকের অনুমতির অপেক্ষায়…', 'Waiting for microphone permission…')}
                {voice.voiceStage === 'recording' && t('শুনছি… শেষ হলে মাইক চাপুন।', 'Listening… tap the microphone when done.')}
                {voice.voiceStage === 'transcribing' && t('কথা থেকে লেখা তৈরি হচ্ছে…', 'Converting your speech to text…')}
              </span>
              <button type="button" onClick={voice.cancelRecording}>{t('বাতিল', 'Cancel')}</button>
            </div>
          )}
          <form className="ag-chat-composer" onSubmit={submit}>
            <button type="button" className="ag-chat-icon ag-chat-picture" title={t('ছবি দিয়ে ফসল পরীক্ষা', 'Open crop image analysis')}
              aria-label={t('ছবি দিয়ে ফসল পরীক্ষা', 'Open crop image analysis')} disabled={!!pending} onClick={() => imageDialog.current?.showModal()}>
              <ImageIcon aria-hidden="true" />
            </button>
            <textarea ref={composer} rows={1} maxLength={MAX_MESSAGE_LENGTH} value={input} readOnly={!!pending}
              onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKey}
              aria-label={t('কৃষি বিষয়ে প্রশ্ন লিখুন', 'Write your agriculture question')}
              placeholder={t('কৃষি বিষয়ে প্রশ্ন লিখুন…', 'Write your agriculture question…')} />
            <div className="ag-chat-voice-controls">
              <select value={voice.recordingLanguage} onChange={(event) => voice.setRecordingLanguage(event.target.value === 'en' ? 'en' : 'bn')}
                disabled={!!voice.voiceStage || !!pending || loading || working || sessionExpired}
                aria-label={t('কথা বলার ভাষা', 'Dictation language')}
                title={t('কথা বলার ভাষা', 'Dictation language')}>
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
              </select>
              <button type="button" className="ag-chat-icon ag-chat-microphone"
                title={voice.voiceStage === 'recording' ? t('রেকর্ডিং শেষ করুন', 'Finish recording')
                  : t('মাইক দিয়ে লিখুন। শেষ করলে অডিও থেকে লেখা তৈরি হবে।', 'Dictate with microphone. Finish to transcribe the recording.')}
                aria-label={voice.voiceStage === 'recording' ? t('রেকর্ডিং শেষ করুন', 'Finish recording') : t('মাইক দিয়ে লিখুন', 'Dictate with microphone')}
                aria-pressed={voice.voiceStage === 'recording'}
                disabled={!!pending || loading || working || sessionExpired || voice.voiceStage === 'requesting' || voice.voiceStage === 'transcribing'}
                onClick={voice.voiceStage === 'recording' ? voice.stopRecording : () => void voice.startRecording()}>
                {voice.voiceStage === 'recording' ? <Square aria-hidden="true" />
                  : voice.voiceStage ? <LoaderCircle className="ag-chat-spin" aria-hidden="true" /> : <Mic aria-hidden="true" />}
              </button>
            </div>
            <button type="submit" className="ag-chat-gold ag-chat-send" aria-label={t('পাঠান', 'Send')}
              disabled={!input.trim() || !!pending || loading || working || sessionExpired || !!voice.voiceStage}>
              {pending ? <LoaderCircle className="ag-chat-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              <span>{t('পাঠান', 'Send')}</span>
            </button>
          </form>
        </div>
      </div>

      <div className="ag-chat-toast-position" role="status" aria-live="polite">{notice && <p>{notice}</p>}</div>
      <dialog className="ag-chat-dialog" ref={imageDialog} aria-labelledby="ag-chat-image-title"
        onClick={(event) => { if (event.target === event.currentTarget) imageDialog.current?.close(); }}>
        <form method="dialog" className="ag-chat-dialog-close">
          <button className="ag-chat-icon" aria-label={t('বন্ধ করুন', 'Close')}><X aria-hidden="true" /></button>
        </form>
        <h2 id="ag-chat-image-title">{t('ছবি দিয়ে ফসল পরীক্ষা', 'Crop image analysis')}</h2>
        <button type="button" onClick={() => { imageDialog.current?.close(); onSelectModelTool('rice_disease'); }}>
          <Wheat aria-hidden="true" />{t('ধানের পাতা পরীক্ষা', 'Analyze rice leaves')}
        </button>
        <button type="button" onClick={() => { imageDialog.current?.close(); onSelectModelTool('tomato_disease_v3'); }}>
          <Apple aria-hidden="true" />{t('টমেটোর পাতা পরীক্ষা', 'Analyze tomato leaves')}
        </button>
        <form method="dialog"><button className="ag-chat-dialog-back"><ArrowLeft aria-hidden="true" />{t('চ্যাটে ফিরে যান', 'Back to chat')}</button></form>
      </dialog>
    </section>
  );
}
