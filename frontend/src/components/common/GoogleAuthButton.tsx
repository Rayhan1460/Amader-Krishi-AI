import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { getErrorMessage } from '../../services/api.ts';
import { AlertCircle, HelpCircle } from 'lucide-react';

interface GoogleAuthButtonProps {
  mode?: 'signin' | 'signup';
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleAuthButton({
  mode = 'signin',
  onSuccess,
  onError,
  className = '',
}: GoogleAuthButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [configHelpOpen, setConfigHelpOpen] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const isConfigured = Boolean(clientId && clientId.trim() && !clientId.includes('YOUR_GOOGLE_CLIENT_ID'));

  useEffect(() => {
    if (!isConfigured) return;

    let isMounted = true;

    // Dynamically load Google Identity Services SDK if not already in document
    const loadGisScript = () => {
      if (window.google?.accounts?.id) {
        initializeGoogleButton();
        return;
      }
      const existingScript = document.getElementById('google-identity-services');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'google-identity-services';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (isMounted) initializeGoogleButton();
        };
        script.onerror = () => {
          if (isMounted && onError) {
            onError('Google Identity Services SDK লোড করতে ব্যর্থ হয়েছে।');
          }
        };
        document.body.appendChild(script);
      } else {
        existingScript.addEventListener('load', () => {
          if (isMounted) initializeGoogleButton();
        });
      }
    };

    const initializeGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleBtnContainerRef.current) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential: string }) => {
            if (!response?.credential) return;
            setIsProcessing(true);
            try {
              await loginWithGoogle(response.credential);
              if (onSuccess) onSuccess();
            } catch (err) {
              const msg = getErrorMessage(err);
              if (onError) onError(msg);
            } finally {
              setIsProcessing(false);
            }
          },
        });

        // Render official Google button into container
        googleBtnContainerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: '100%',
        });
      } catch (err) {
        console.error('Google button render error:', err);
      }
    };

    loadGisScript();

    return () => {
      isMounted = false;
    };
  }, [clientId, isConfigured, mode, loginWithGoogle, onSuccess, onError]);

  const handleUnconfiguredClick = () => {
    setConfigHelpOpen(!configHelpOpen);
  };

  if (!isConfigured) {
    return (
      <div id={mode === 'signup' ? 'google-signup-container' : 'google-signin-container'} className={`w-full ${className}`}>
        <button
          type="button"
          onClick={handleUnconfiguredClick}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-sage-200 bg-white hover:bg-cream-50 text-xs font-medium text-charcoal-800 transition-colors shadow-2xs group cursor-pointer"
          title="Google Sign-In কনফিগারেশন বিবরণ দেখতে ক্লিক করুন"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span className="font-bengali">
              {mode === 'signup' ? 'Google দিয়ে নিবন্ধন করুন' : 'Google দিয়ে সাইন ইন করুন'}
            </span>
          </div>

          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            <span>OAuth Setup Required</span>
          </span>
        </button>

        {configHelpOpen && (
          <div className="mt-2.5 p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-left text-xs text-amber-900 leading-relaxed font-bengali shadow-xs animate-fade-in-up">
            <div className="flex items-start gap-2 mb-1.5 font-semibold text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>Google Identity Services সক্রিয় করার নির্দেশিকা:</span>
            </div>
            <p className="text-[11px] text-amber-800 mb-2">
              Google Sign-In ব্যবহারের জন্য Google Cloud Console থেকে একটি Web OAuth 2.0 Client ID তৈরি করে নিচের ফাইলে যুক্ত করুন:
            </p>
            <div className="font-mono text-[10px] bg-white/90 p-2 rounded border border-amber-300 space-y-1 text-charcoal-900">
              <p># In root or frontend .env:</p>
              <p className="text-forest-700 font-bold">VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com</p>
              <p># In backend .env:</p>
              <p className="text-forest-700 font-bold">GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com</p>
            </div>
            <p className="text-[10px] text-amber-700 mt-2 font-normal">
              অনুমোদিত জাভাস্ক্রিপ্ট অরিজিন: <code className="font-mono">http://localhost:5173</code> ও <code className="font-mono">http://127.0.0.1:5173</code>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id={mode === 'signup' ? 'google-signup-container' : 'google-signin-container'} className={`w-full ${className}`}>
      {isProcessing && (
        <div className="py-2.5 text-center text-xs font-bengali text-forest-700 flex items-center justify-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-forest-600 border-t-transparent rounded-full animate-spin" />
          <span>Google একাউন্ট যাচাই করা হচ্ছে...</span>
        </div>
      )}
      <div
        ref={googleBtnContainerRef}
        className={`w-full flex justify-center ${isProcessing ? 'opacity-40 pointer-events-none' : ''}`}
      />
    </div>
  );
}

