import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-sage-600">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full text-sm rounded-xl py-2.5 bg-white/90 border transition-all duration-200 focus:outline-none focus:ring-2 placeholder:text-sage-400 text-charcoal-900 ${
              leftIcon ? 'pl-10' : 'pl-3.5'
            } ${rightIcon ? 'pr-10' : 'pr-3.5'} ${
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                : 'border-sage-300 focus:border-forest-600 focus:ring-forest-200'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-sage-600">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
        {!error && helperText && (
          <p className="mt-1 text-xs text-sage-600">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
