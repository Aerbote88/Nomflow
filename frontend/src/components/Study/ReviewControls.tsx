import React from 'react';
import { Button } from '@/components/ui';

interface ReviewControlsProps {
    isFlipped: boolean;
    onShow: () => void;
    onSubmit: (rating: number) => void;
    intervals?: { [key: number]: string };
    isPractice?: boolean;
}

export const ReviewControls: React.FC<ReviewControlsProps> = ({ isFlipped, onShow, onSubmit, intervals, isPractice }) => {
    if (!isFlipped) {
        return (
            <div className="w-full max-w-[600px] mt-6">
                <Button size="lg" className="w-full py-6 text-xl shadow-xl shadow-accent-primary/20" onClick={onShow}>
                    Reveal Answer
                </Button>
            </div>
        );
    }

    if (isPractice) {
        return (
            <div className="w-full max-w-[600px] mt-6 grid grid-cols-2 gap-3">
                <button
                    onClick={() => onSubmit(0)}
                    className="bg-red-500/15 hover:bg-red-500/25 border-2 border-red-500/30 hover:border-red-500/60 text-red-400 font-black py-4 md:py-5 rounded-xl active:scale-[0.98] transition-all"
                >
                    <span className="text-[10px] md:text-xs uppercase tracking-widest">✗ Incorrect</span>
                </button>
                <button
                    onClick={() => onSubmit(2)}
                    className="bg-emerald-500/15 hover:bg-emerald-500/25 border-2 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 font-black py-4 md:py-5 rounded-xl active:scale-[0.98] transition-all"
                >
                    <span className="text-[10px] md:text-xs uppercase tracking-widest">✓ Correct</span>
                </button>
            </div>
        );
    }

    const ratings = [
        { label: 'Again', color: 'bg-red-500 hover:bg-red-400', value: 0 },
        { label: 'Hard', color: 'bg-orange-500 hover:bg-orange-400', value: 1 },
        { label: 'Good', color: 'bg-emerald-500 hover:bg-emerald-400', value: 2 },
        { label: 'Easy', color: 'bg-blue-500 hover:bg-blue-400', value: 3 },
    ];

    return (
        <div className="w-full max-w-[600px] mt-6 grid grid-cols-4 gap-2 md:gap-3">
            {ratings.map((rating) => (
                <button
                    key={rating.value}
                    onClick={() => onSubmit(rating.value)}
                    className={`${rating.color} text-white font-black py-3 md:py-5 rounded-xl active:scale-[0.98] flex flex-col items-center justify-center shadow-lg group`}
                >
                    <span className="text-[10px] md:text-xs uppercase tracking-widest mb-1 group-hover:scale-110 transition-transform">
                        {rating.label}
                    </span>
                    {intervals && intervals[rating.value] && (
                        <span className="text-[8px] md:text-[10px] opacity-70 font-bold px-1.5 md:px-2 py-0.5 bg-black/10 rounded-full">
                            {intervals[rating.value]}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
};
