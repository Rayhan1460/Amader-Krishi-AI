/**
 * আমাদের কৃষি (Our Agriculture AI) — Core Design Tokens & System Theme
 * Shared design contracts for Landing Page, Authentication, AI Workspace, and Future Dashboards
 */

export const BRAND = {
  name: 'আমাদের কৃষি',
  nameEn: 'Our Agriculture',
  platformName: 'আমাদের কৃষি AI',
  platformNameEn: 'Our Agriculture AI',
  tagline: 'প্রযুক্তির ছোঁয়ায়, স্মার্ট কৃষির পথে।',
  taglineEn: 'Empowering agriculture through intelligent technology.',
  version: '1.0.0-phase-f1',
} as const;

export const COLOR_TOKENS = {
  // Deep Forest Green surfaces
  forest: {
    base: '#0F291E',
    dark: '#071810',
    deep: '#040F0A',
    surface: '#16432E',
    light: '#327757',
    vibrant: '#43956F',
    subtle: '#E1EFE5',
  },
  // Golden Harvest Accents
  gold: {
    primary: '#EAB308',
    light: '#FEF08A',
    warm: '#F59E0B',
    deep: '#B45309',
    glow: 'rgba(234, 179, 8, 0.28)',
  },
  // Charcoal and Dark Surfaces
  charcoal: {
    950: '#0A0D0B',
    900: '#121714',
    800: '#1C2420',
    700: '#2B342E',
    muted: '#4A5D4D',
  },
  // Warm Cream Backgrounds & Paper
  cream: {
    pure: '#FFFFFF',
    light: '#FDFCF9',
    surface: '#FBF8EE',
    border: '#EBE1CB',
    card: 'rgba(255, 255, 255, 0.88)',
  },
  // Semantic Feedback
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  }
} as const;

export const TYPOGRAPHY = {
  fonts: {
    bengali: "'Hind Siliguri', 'SolaimanLipi', 'Kalpurush', system-ui, sans-serif",
    english: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif",
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  }
} as const;

export const SPACING = {
  pageMax: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  sectionY: 'py-16 sm:py-20 lg:py-24',
  heroY: 'pt-28 pb-16 sm:pt-36 sm:pb-24 lg:pt-40 lg:pb-32',
  cardPadding: 'p-6 sm:p-8',
  gapGrid: 'gap-6 lg:gap-8',
} as const;

export const RADII = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
  full: 'rounded-full',
} as const;

export const SHADOWS = {
  card: 'shadow-[0_4px_20px_-2px_rgba(15,41,30,0.06)]',
  cardHover: 'hover:shadow-[0_12px_32px_-4px_rgba(15,41,30,0.12)]',
  darkCard: 'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]',
  glowGold: 'shadow-[0_0_30px_rgba(234,179,8,0.25)]',
  glowForest: 'shadow-[0_0_35px_rgba(67,149,111,0.25)]',
} as const;

export const TRANSITIONS = {
  fast: 'transition-all duration-150 ease-out',
  base: 'transition-all duration-250 ease-out',
  smooth: 'transition-all duration-350 cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

