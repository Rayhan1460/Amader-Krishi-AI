import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'forest' | 'sage' | 'amber' | 'blue' | 'red' | 'charcoal';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export function Badge({
  children,
  variant = 'forest',
  size = 'md',
  className = '',
  dot = false,
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[11px] px-2.5 py-0.5 tracking-wide',
    md: 'text-xs px-3 py-1 tracking-normal',
  };

  const variantStyles = {
    forest: 'bg-forest-100 text-forest-800 border border-forest-300/80',
    sage: 'bg-sage-100 text-sage-800 border border-sage-300',
    amber: 'bg-amber-50 text-amber-800 border border-amber-300',
    blue: 'bg-sky-50 text-sky-800 border border-sky-200',
    red: 'bg-rose-50 text-rose-800 border border-rose-200',
    charcoal: 'bg-charcoal-800 text-cream-100 border border-charcoal-700',
  };

  const dotColors = {
    forest: 'bg-forest-600',
    sage: 'bg-sage-600',
    amber: 'bg-amber-500',
    blue: 'bg-sky-500',
    red: 'bg-rose-500',
    charcoal: 'bg-emerald-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
