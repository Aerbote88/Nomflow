import React, { useEffect, useState } from 'react';

interface StatCardProps {
    label: string;
    value: string | number;
    colorClass?: string;
    icon?: string;
    className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, colorClass = 'text-text-primary', icon, className = '' }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        if (typeof value === 'number') {
            let start = 0;
            const end = value;
            const duration = 1000;
            let startTime: number | null = null;

            const step = (timestamp: number) => {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / duration, 1);
                setDisplayValue(Math.floor(progress * (end - start) + start));
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };

            window.requestAnimationFrame(step);
        }
    }, [value]);

    return (
        <div className={`glass-card flex flex-col items-center justify-center p-4 md:p-6 flex-1 min-w-[120px] ${className}`}>
            <span className="text-[0.6rem] md:text-sm text-text-secondary uppercase tracking-widest text-center w-full mb-1 leading-tight break-words">
                {label}
            </span>
            <div className="flex items-center gap-1 md:gap-2">
                {icon && <span className="text-lg md:text-3xl">{icon}</span>}
                <span className={`text-xl md:text-4xl font-bold ${colorClass}`}>
                    {typeof value === 'number' ? displayValue : value}
                </span>
            </div>
        </div>
    );
};

export const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-3">
        <div
            className="h-full bg-gradient-to-r from-accent-primary to-[#a78bfa] transition-all duration-1000 ease-out"
            style={{ width: `${progress * 100}%` }}
        />
    </div>
);
