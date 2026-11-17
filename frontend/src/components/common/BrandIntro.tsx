import { useState, useEffect } from 'react';
import { BRAND } from '../../styles/designTokens.ts';

const INTRO_STORAGE_KEY = 'amader_krishi_intro_seen_v1';

interface BrandIntroProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function BrandIntro({ onComplete, forceShow = false }: BrandIntroProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasSeenIntro = sessionStorage.getItem(INTRO_STORAGE_KEY);

    if ((hasSeenIntro && !forceShow) || prefersReducedMotion) {
      if (onComplete) onComplete();
      return;
    }

    // Show intro
    setIsVisible(true);

    // Sequence timing: auto dismiss after 1.8 seconds
    const fadeTimer = setTimeout(() => {
      handleDismiss();
    }, 1900);

    return () => {
      clearTimeout(fadeTimer);
    };
  }, [forceShow, onComplete]);

  const handleDismiss = () => {
    setIsFadingOut(true);
    sessionStorage.setItem(INTRO_STORAGE_KEY, 'true');
    setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, 350); // Match fade transition duration
  };

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-label="Welcome to Amader Krishi AI"
      aria-modal="true"
      data-testid="brand-intro"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-forest-950 overflow-hidden px-4 transition-opacity duration-350 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-radial-gradient from-forest-900 via-forest-950 to-[#040E08] pointer-events-none" />
      
      {/* Subtle field grid pattern */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#43956F_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Golden soft spotlight behind emblem */}
      <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gold-500/15 blur-3xl animate-pulse-glow pointer-events-none" />

      {/* Accessible Skip Button */}
      <button
        type="button"
        data-testid="skip-brand-intro"
        onClick={handleDismiss}
        className="absolute top-6 right-6 z-[110] text-xs sm:text-sm font-bengali font-medium text-forest-300 hover:text-gold-300 bg-forest-900/80 hover:bg-forest-800 px-3.5 py-1.5 rounded-full border border-forest-700/80 transition-colors backdrop-blur-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-400"
      >
        এগিয়ে যান (Skip) →
      </button>

      {/* Centered Animated Brand Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md mx-auto">
        
        {/* Animated Sprout Emblem */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-5 animate-sprout-grow">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-[0_10px_25px_rgba(34,197,94,0.25)]"
          >
            {/* Hexagonal / Rounded Soil Parcel Base */}
            <rect width="48" height="48" rx="14" fill="#0A2318" stroke="#1D4E37" strokeWidth="1" />
            
            {/* Field contour rings */}
            <circle cx="24" cy="24" r="21" stroke="#1D4E37" strokeWidth="1" strokeDasharray="3 3" />
            <path
              d="M6 34C11 31 17 31 24 34C31 37 37 37 42 34"
              stroke="#2B6B4C"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M8 39C13 37 18 37 24 39C30 41 35 41 40 39"
              stroke="#1D4E37"
              strokeWidth="1.2"
              strokeLinecap="round"
            />

            {/* Glowing Golden Sun */}
            <circle cx="24" cy="18" r="9" fill="url(#intro_sun)" opacity="0.9" />
            
            {/* Central Sprout Stem */}
            <path
              d="M24 36V19"
              stroke="#FBF8EE"
              strokeWidth="2.8"
              strokeLinecap="round"
            />

            {/* Right Leaf */}
            <path
              d="M24 23C27 18 35 17 37 23C35 29 27 28 24 26"
              fill="url(#intro_leaf_r)"
            />

            {/* Left Leaf */}
            <path
              d="M24 27C21 22 13 22 11 27C13 32 21 31 24 29"
              fill="url(#intro_leaf_l)"
            />

            {/* Golden Peak Drop */}
            <circle cx="24" cy="13" r="2.8" fill="#FACC15" />

            <defs>
              <radialGradient id="intro_sun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24 18) rotate(90) scale(11)">
                <stop stopColor="#F59E0B" stopOpacity="0.6" />
                <stop offset="1" stopColor="#EAB308" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="intro_leaf_r" x1="24" y1="17" x2="37" y2="29" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4ADE80" />
                <stop offset="1" stopColor="#16A34A" />
              </linearGradient>
              <linearGradient id="intro_leaf_l" x1="24" y1="22" x2="11" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#86EFAC" />
                <stop offset="1" stopColor="#15803D" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Brand Name Title */}
        <div className="flex items-center gap-2.5 mb-2 animate-fade-in-up [animation-delay:300ms]">
          <h1 className="font-bengali font-bold text-3xl sm:text-4xl text-cream-50 tracking-tight">
            {BRAND.name}
          </h1>
          <span className="font-english font-bold text-xs uppercase px-2 py-0.5 rounded-md bg-gold-400 text-forest-950 shadow-sm">
            AI
          </span>
        </div>

        {/* Official Tagline */}
        <p className="font-bengali text-sm sm:text-base text-gold-300/90 tracking-normal font-normal animate-fade-in-up [animation-delay:600ms]">
          {BRAND.tagline}
        </p>

        {/* Subtle Loading Pulse Line */}
        <div className="w-24 h-0.5 mt-6 rounded-full bg-forest-800 overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-emerald-400 via-gold-400 to-emerald-400 animate-[pulse-glow_1.5s_infinite]" />
        </div>

      </div>
    </div>
  );
}

export default BrandIntro;
