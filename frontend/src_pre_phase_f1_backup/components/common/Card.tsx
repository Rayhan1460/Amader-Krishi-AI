import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'glass' | 'white' | 'dark' | 'outline';
  hoverEffect?: boolean;
}

export function Card({
  children,
  variant = 'glass',
  hoverEffect = false,
  className = '',
  ...props
}: CardProps) {
  const variantStyles = {
    glass: 'glass-card text-charcoal-900',
    white: 'bg-white border border-sage-200/80 shadow-sm text-charcoal-900',
    dark: 'glass-card-dark text-cream-100 shadow-xl',
    outline: 'border border-sage-300/80 bg-cream-50/70 text-charcoal-900',
  };

  const hoverStyle = hoverEffect
    ? 'transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-forest-400'
    : '';

  return (
    <div
      className={`rounded-2xl p-6 relative overflow-hidden ${variantStyles[variant]} ${hoverStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
