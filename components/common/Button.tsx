
import React, { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ children, variant = 'primary', size = 'md', className = '', ...props }, ref) => {
  const baseStyles = 'rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  
  const sizeStyles = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  const variantStyles = {
    primary: 'bg-teal-500 hover:bg-teal-600 focus:ring-teal-500 text-white shadow-md',
    secondary: 'bg-gray-700 hover:bg-gray-600 focus:ring-gray-500 text-gray-100',
    ghost: 'bg-transparent hover:bg-gray-700/50 focus:ring-teal-500 text-teal-400',
  };

  return (
    <button ref={ref} className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
});

export default Button;
