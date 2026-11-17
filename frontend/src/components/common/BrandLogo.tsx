import { BRAND } from '../../styles/designTokens.ts';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'auto';
  showText?: boolean;
  withTagline?: boolean;
  withAiBadge?: boolean;
  className?: string;
  animate?: boolean;
}

export function BrandLogo({
  size = 'md',
  variant = 'auto',
  showText = true,
  withTagline = false,
  withAiBadge = true,
  className = '',
  animate = false,
}: BrandLogoProps) {
  // Dimensions based on size token
  const sizeMap = {
    sm: { icon: 28, text: 'text-lg', badge: 'text-[9px] px-1.5 py-0.5' },
    md: { icon: 38, text: 'text-xl sm:text-2xl', badge: 'text-[10px] px-2 py-0.5' },
    lg: { icon: 52, text: 'text-2xl sm:text-3xl', badge: 'text-xs px-2.5 py-0.5' },
    xl: { icon: 72, text: 'text-3xl sm:text-4xl', badge: 'text-sm px-3 py-1' },
  };

  const currentSize = sizeMap[size];

  // Text color based on surface
  const titleColor =
    variant === 'dark'
      ? 'text-cream-50'
      : variant === 'light'
      ? 'text-forest-950'
      : 'text-forest-950 dark:text-cream-50';

  const taglineColor =
    variant === 'dark'
      ? 'text-forest-300'
      : variant === 'light'
      ? 'text-sage-700'
      : 'text-sage-700 dark:text-forest-300';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Original SVG Brand Emblem: Sprout emerging from agricultural field geometry */}
      <div
        className={`relative shrink-0 flex items-center justify-center rounded-2xl p-1.5 transition-transform duration-300 ${
          animate ? 'hover:scale-105' : ''
        }`}
        style={{ width: currentSize.icon, height: currentSize.icon }}
      >
        <img
          src="/amader_krishi_OFFICIAL_LOGO.png"
          alt="Amader Krishi AI"
          className="absolute inset-0 w-full h-full object-contain rounded-lg"
        />
        <svg
          className="hidden"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Hexagonal / Rounded Soil Parcel Base */}
          <rect width="48" height="48" rx="14" fill="#0A2318" />
          
          {/* Subtle Agricultural Field Contour Rings */}
          <circle cx="24" cy="24" r="21" stroke="#1D4E37" strokeWidth="1.2" strokeDasharray="3 3" />
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

          {/* Golden Sun / Harvest Dawn Arc */}
          <circle cx="24" cy="18" r="9" fill="url(#golden_sun_glow)" opacity="0.85" />
          
          {/* Central Stem */}
          <path
            d="M24 36V19"
            stroke="#FBF8EE"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Primary Vigorous Leaf (Right) */}
          <path
            d="M24 23C27 18 35 17 37 23C35 29 27 28 24 26"
            fill="url(#leaf_gradient_right)"
          />

          {/* Secondary Emerging Sprout Leaf (Left) */}
          <path
            d="M24 27C21 22 13 22 11 27C13 32 21 31 24 29"
            fill="url(#leaf_gradient_left)"
          />

          {/* Golden Seed Drop Peak */}
          <circle cx="24" cy="13" r="2.8" fill="#FACC15" />

          {/* Shimmer definitions */}
          <defs>
            <radialGradient id="golden_sun_glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24 18) rotate(90) scale(10)">
              <stop stopColor="#F59E0B" stopOpacity="0.45" />
              <stop offset="1" stopColor="#EAB308" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="leaf_gradient_right" x1="24" y1="17" x2="37" y2="29" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4ADE80" />
              <stop offset="1" stopColor="#22C55E" />
            </linearGradient>
            <linearGradient id="leaf_gradient_left" x1="24" y1="22" x2="11" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#86EFAC" />
              <stop offset="1" stopColor="#16A34A" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className={`font-bengali font-bold tracking-tight leading-none ${currentSize.text} ${titleColor}`}>
              {BRAND.name}
            </span>
            {withAiBadge && (
              <span className={`font-english font-bold uppercase rounded-md tracking-wider bg-gold-400 text-forest-950 shadow-xs ${currentSize.badge}`}>
                AI
              </span>
            )}
          </div>
          {withTagline && (
            <span className={`font-bengali text-xs tracking-normal mt-1 leading-tight ${taglineColor}`}>
              {BRAND.tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default BrandLogo;
