import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick }) => (
    <div
        className={`glass-card p-6 md:p-8 ${className} ${onClick ? 'cursor-pointer hover:-translate-y-1 transition-[background-color,border-color,box-shadow,transform,opacity] duration-300' : ''}`}
        onClick={onClick}
    >
        {children}
    </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

    const variants = {
        primary: 'bg-accent-primary text-white hover:bg-accent-hover shadow-md shadow-accent-primary/10',
        secondary: 'bg-bg-secondary text-text-primary hover:bg-white/10 border border-white/10',
        outline: 'bg-transparent border-2 border-accent-primary text-accent-primary hover:bg-accent-primary/5',
        ghost: 'bg-transparent text-text-secondary hover:text-accent-primary hover:bg-accent-primary/5',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-6 py-3',
        lg: 'px-8 py-4 text-lg',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

export * from './Portal';
