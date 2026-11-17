import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import {
  Bot,
  User,
  Send,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  Eye,
  Layers,
  Waves,
  TrendingUp,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { chatApi, getErrorMessage } from '../../services/api.ts';
import type { ChatSession, ChatMessage, ChatProviderStatus } from '../../types/index.ts';
import { Button } from '../common/Button.tsx';

interface ChatViewProps {
  onSelectModelTool?: (modelId: string) => void;
}

export function ChatView({ onSelectModelTool }: ChatViewProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [providerStatus, setProviderStatus] = useState<ChatProviderStatus | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat sessions and provider status on mount
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      try {
        const [list, pStatus] = await Promise.all([
          chatApi.listSessions(),
          chatApi.getProviderStatus().catch(() => null),
        ]);
        if (isMounted) {
          if (pStatus) setProviderStatus(pStatus);
          setSessions(list);
          if (list.length > 0) {
            setActiveSession(list[0]);
          } else {
            // Automatically create first consultation session
            const newSession = await chatApi.createSession('General Agricultural Consultation');
            setSessions([newSession]);
            setActiveSession(newSession);
          }
        }
      } catch (err) {
        if (isMounted) setError(getErrorMessage(err));
      } finally {
        if (isMounted) setIsLoadingSessions(false);
      }
    }

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isSending]);

  const handleCreateSession = async () => {
    try {
      const count = sessions.length + 1;
      const newSession = await chatApi.createSession(`Consultation Session #${count}`);
      setSessions([newSession, ...sessions]);
      setActiveSession(newSession);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation();
    try {
      await chatApi.deleteSession(sessionId);
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      if (activeSession?.id === sessionId) {
        if (remaining.length > 0) {
          setActiveSession(remaining[0]);
        } else {
          const fresh = await chatApi.createSession('New Consultation');
          setSessions([fresh]);
          setActiveSession(fresh);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const content = inputContent.trim();
    if (!content || !activeSession || isSending) return;

    setInputContent('');
    setIsSending(true);
    setError(null);

    // Optimistic user message addition
    const optimisticUserMsg: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...(activeSession.messages || []), optimisticUserMsg];
    setActiveSession({
      ...activeSession,
      messages: updatedMessages,
    });

    try {
      const updatedSession = await chatApi.postMessage(activeSession.id, content);
      setActiveSession(updatedSession);
      // Update in sessions list
      setSessions(sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickPrompts = [
    {
      label: 'Diagnose tomato blight spots',
      prompt: 'I have brown circular spots on my tomato leaves with yellow rings. What is the diagnosis?',
      modelId: 'tomato_disease_v3',
    },
    {
      label: 'Recommend crop for high Nitrogen',
      prompt: 'My soil test shows N=90, P=42, K=43, pH=6.5. What crop is recommended for this soil?',
      modelId: 'crop_recommendation',
    },
    {
      label: 'Wholesale tomato price baseline',
      prompt: 'What is the current weekly wholesale market price benchmark for tomatoes in Bangladesh?',
      modelId: 'tomato_price',
    },
    {
      label: 'Flood risk assessment criteria',
      prompt: 'How do elevation, river proximity, and drainage density impact flood susceptibility?',
      modelId: 'flood_susceptibility',
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden flex flex-col h-[750px] max-h-[85vh]">
      
      {/* Top Session & Provider Bar */}
      <div className="bg-cream-50/90 border-b border-sage-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Active Session Title & Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 min-w-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCreateSession}
            leftIcon={<Plus className="w-3.5 h-3.5 text-forest-700" />}
            className="shrink-0 text-xs py-1.5"
          >
            New Consultation
          </Button>

          <div className="h-5 w-px bg-sage-300 mx-1 shrink-0" />

          {sessions.map((s) => {
            const isActive = activeSession?.id === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setActiveSession(s)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 group ${
                  isActive
                    ? 'bg-forest-800 text-white shadow-xs'
                    : 'bg-white text-charcoal-700 border border-sage-200 hover:bg-sage-100'
                }`}
              >
                <span>{s.title}</span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-opacity cursor-pointer ${
                    isActive ? 'text-sage-300' : 'text-sage-500'
                  }`}
                  aria-label="Delete session"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right: Active Provider Status Badge & Tool Shortcuts */}
        <div className="flex items-center gap-2.5 shrink-0">
          {providerStatus && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border shadow-2xs transition-colors ${
                providerStatus.is_external_llm_configured
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-cream-100 text-charcoal-800 border-sage-300'
              }`}
              title={
                providerStatus.disclaimer ||
                providerStatus.description ||
                'AgriSphere AI Assistant Engine'
              }
            >
              {providerStatus.is_external_llm_configured ? (
                <>
                  <Sparkles className="w-3 h-3 text-emerald-600 animate-pulse shrink-0" />
                  <span className="font-semibold">{providerStatus.mode_label}</span>
                  {providerStatus.model && (
                    <span className="text-[10px] text-emerald-700 hidden sm:inline">
                      ({providerStatus.model})
                    </span>
                  )}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-forest-700 shrink-0" />
                  <span className="font-semibold">{providerStatus.mode_label}</span>
                  <span className="text-[10px] text-sage-600 hidden md:inline">
                    (Offline Heuristics)
                  </span>
                </>
              )}
            </div>
          )}

          {/* Model Launch Shortcuts */}
          {onSelectModelTool && (
            <div className="hidden lg:flex items-center gap-1 shrink-0 text-xs border-l border-sage-200 pl-2">
              <span className="text-[10px] text-sage-600 font-semibold mr-0.5">Tools:</span>
              <button
                type="button"
                onClick={() => onSelectModelTool('tomato_disease_v3')}
                className="p-1.5 rounded-lg bg-white border border-sage-200 hover:border-forest-400 text-forest-800 transition-colors"
                title="Tomato Disease Scanner"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectModelTool('crop_recommendation')}
                className="p-1.5 rounded-lg bg-white border border-sage-200 hover:border-forest-400 text-emerald-800 transition-colors"
                title="Crop Recommendation"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectModelTool('flood_susceptibility')}
                className="p-1.5 rounded-lg bg-white border border-sage-200 hover:border-forest-400 text-sky-800 transition-colors"
                title="Flood Risk"
              >
                <Waves className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectModelTool('tomato_price')}
                className="p-1.5 rounded-lg bg-white border border-sage-200 hover:border-forest-400 text-amber-800 transition-colors"
                title="Market Pricing"
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gradient-to-b from-white to-cream-50/40">
        {isLoadingSessions ? (
          <div className="flex flex-col items-center justify-center h-full text-sage-600">
            <Loader2 className="w-6 h-6 animate-spin text-forest-700 mb-2" />
            <p className="text-xs">Connecting to consultation session...</p>
          </div>
        ) : activeSession?.messages?.length === 0 ? (
          <div className="text-center py-12 text-sage-600">
            <Bot className="w-10 h-10 mx-auto text-forest-400 mb-2" />
            <p className="text-sm font-semibold text-charcoal-800">Start your agronomic consultation</p>
            <p className="text-xs max-w-sm mx-auto mt-1">
              Ask about foliar disease diagnosis, soil nutrient suitability, yield models, or wholesale market prices.
            </p>
          </div>
        ) : (
          activeSession?.messages?.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-forest-900 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-4 max-w-xl text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-forest-800 text-white rounded-tr-xs shadow-xs'
                      : 'bg-white border border-sage-200/90 text-charcoal-900 rounded-tl-xs shadow-xs'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div>{renderFormattedMessage(msg.content)}</div>
                  )}

                  {/* Tool Invocations Badge if any tools were executed */}
                  {!isUser && (msg.metadata?.tool_invocations?.length ?? 0) > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-sage-200 space-y-2">
                      {msg.metadata?.tool_invocations?.map((ti: any, tIdx: number) => (
                        <div
                          key={tIdx}
                          className="bg-cream-50 p-2.5 rounded-xl border border-sage-200 text-[11px] text-charcoal-800"
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-forest-800 mb-1">
                            <Cpu className="w-3.5 h-3.5 text-forest-600" />
                            <span>Executed Tool: {ti.tool}</span>
                          </div>
                          {ti.result?.caveat && (
                            <p className="text-[10px] text-sage-600 italic mt-0.5">
                              {ti.result.caveat}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timestamp & Provider Disclosure */}
                  <div
                    className={`mt-2.5 pt-1.5 flex items-center justify-between text-[10px] ${
                      isUser ? 'text-forest-200' : 'text-sage-500 border-t border-sage-100'
                    }`}
                  >
                    <span>
                      {isUser ? (
                        'You'
                      ) : msg.provider === 'gemini' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800 font-medium">
                          <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Google Gemini AI
                        </span>
                      ) : msg.provider === 'ollama' ? (
                        <span className="inline-flex items-center gap-1 text-forest-800 font-medium">
                          <Cpu className="w-2.5 h-2.5 text-forest-600" /> Ollama Local LLM
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-charcoal-700">
                          <ShieldCheck className="w-2.5 h-2.5 text-forest-600" /> Local Advisory Engine
                        </span>
                      )}
                    </span>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-forest-100 text-forest-800 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isSending && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-forest-900 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-sage-200 rounded-2xl rounded-tl-xs p-3.5 shadow-xs flex items-center gap-2 text-xs text-sage-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-forest-600" />
              <span>Analyzing query against agronomic knowledge base & research tools...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 bg-cream-50/80 border-t border-sage-200 overflow-x-auto scrollbar-none flex items-center gap-2">
        <span className="text-[11px] font-semibold text-sage-600 flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-forest-600" /> Suggested:
        </span>
        {quickPrompts.map((qp) => (
          <button
            key={qp.label}
            type="button"
            onClick={() => {
              setInputContent(qp.prompt);
              textareaRef.current?.focus();
            }}
            className="text-[11px] bg-white border border-sage-200 text-charcoal-700 hover:border-forest-400 hover:text-forest-900 px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-white border-t border-sage-200">
        <div className="relative flex items-center bg-cream-50/80 rounded-2xl border border-sage-300 focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-200 transition-all p-1.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoadingSessions || !activeSession}
            placeholder={
              isLoadingSessions
                ? 'Connecting to consultation session...'
                : 'Type an agricultural query... (Press Enter to send, Shift+Enter for newline)'
            }
            className="flex-1 bg-transparent border-none text-xs sm:text-sm text-charcoal-900 placeholder:text-sage-500 focus:outline-none resize-none px-3 py-1.5 max-h-32 disabled:opacity-50"
          />

          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSending}
            disabled={!inputContent.trim() || isLoadingSessions || !activeSession}
            className="rounded-xl px-3 py-2 shrink-0 self-end"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-sage-500 mt-1.5 text-center flex items-center justify-center gap-1.5 flex-wrap">
          <span>AgriSphere AI Assistant</span>
          <span>•</span>
          <span>
            {providerStatus?.is_external_llm_configured
              ? 'Google Gemini AI Connected'
              : 'Local Advisory Mode (Offline Heuristics)'}
          </span>
          <span>•</span>
          <span>Multilingual (English / বাংলা)</span>
        </p>
      </form>

    </div>
  );
}

/** Formats message text with lightweight markdown header, bullet point, and code styling */
function renderFormattedMessage(content: string) {
  const lines = content.split('\n');
  return lines.map((line, lIdx) => {
    // Markdown H3 / H4 Headers
    if (line.startsWith('### ')) {
      return (
        <h4 key={lIdx} className="font-bold text-sm text-forest-900 mt-2 mb-1">
          {line.replace('### ', '')}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={lIdx} className="font-bold text-base text-forest-900 mt-2.5 mb-1.5">
          {line.replace('## ', '')}
        </h3>
      );
    }
    // Bullet list items
    if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) {
      const bulletText = line.trim().replace(/^[•\-]\s*/, '');
      return (
        <div key={lIdx} className="flex items-start gap-1.5 my-1 ml-1 text-xs sm:text-sm">
          <span className="text-forest-600 font-bold">•</span>
          <div>{renderFormattedInline(bulletText)}</div>
        </div>
      );
    }
    // Numbered list items
    if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+)\.\s*(.*)/);
      return (
        <div key={lIdx} className="flex items-start gap-1.5 my-1 ml-1 text-xs sm:text-sm">
          <span className="font-semibold text-forest-700">{match ? match[1] : '1'}.</span>
          <div>{renderFormattedInline(match ? match[2] : line)}</div>
        </div>
      );
    }
    // Empty spacer line
    if (!line.trim()) {
      return <div key={lIdx} className="h-1.5" />;
    }
    // Regular line
    return (
      <p key={lIdx} className="text-xs sm:text-sm my-0.5 leading-relaxed">
        {renderFormattedInline(line)}
      </p>
    );
  });
}

/** Parses inline markdown bold, code, and italics */
function renderFormattedInline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\`.*?\`|\*.*?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-charcoal-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="px-1 py-0.5 bg-sage-100 text-forest-900 rounded text-[11px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="text-sage-700 italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
