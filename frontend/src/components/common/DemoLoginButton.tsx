import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { getErrorMessage } from '../../services/api.ts';

interface DemoLoginButtonProps {
  variant?: 'primary' | 'card' | 'compact';
  className?: string;
  onSuccess?: () => void;
  onError?: (err: string) => void;
}

export function DemoLoginButton({
  variant = 'card',
  className = '',
  onSuccess,
  onError,
}: DemoLoginButtonProps) {
  const { loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDemoClick = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loginAsDemo();
      if (onSuccess) onSuccess();
      navigate('/workspace', { replace: true });
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      if (onError) onError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'compact') {
    return (
      <button
        id="demo-login-button"
        type="button"
        onClick={handleDemoClick}
        disabled={isLoading}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bengali font-semibold bg-gold-400 text-forest-950 hover:bg-gold-300 transition-colors shadow-xs cursor-pointer disabled:opacity-50 ${className}`}
      >
        <Sparkles className="w-3.5 h-3.5 text-forest-900" />
        <span>{isLoading ? 'প্রবেশ করা হচ্ছে...' : 'ডেমো দেখুন'}</span>
      </button>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {error && (
        <div className="mb-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-bengali">
          {error}
        </div>
      )}

      <button
        id="demo-login-button"
        type="button"
        onClick={handleDemoClick}
        disabled={isLoading}
        className="w-full relative overflow-hidden group px-4 py-3 rounded-2xl border border-gold-400/80 bg-gradient-to-r from-forest-900 via-forest-850 to-forest-900 hover:from-forest-800 hover:to-forest-800 text-cream-50 font-bengali transition-all duration-300 shadow-md hover:shadow-lg hover:border-gold-300 cursor-pointer disabled:opacity-60 flex items-center justify-between"
      >
        {/* Ambient golden shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-400/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10 text-left">
          <div className="w-9 h-9 rounded-xl bg-gold-400/20 border border-gold-400/40 flex items-center justify-center text-gold-300 shadow-2xs group-hover:scale-105 transition-transform">
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-gold-300" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-gold-300 tracking-tight">
                এক ক্লিকে ডেমো প্রবেশ
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-gold-400/20 text-gold-300 border border-gold-400/30">
                Instant Guest
              </span>
            </div>
            <p className="text-[11px] text-sage-300 font-normal">
              রেজিস্ট্রেশন ছাড়াই ৭টি এআই মডেল পরীক্ষা করুন
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center text-gold-300 text-xs font-semibold gap-1 pl-2">
          <span className="hidden sm:inline">শুরু করুন</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>
    </div>
  );
}

