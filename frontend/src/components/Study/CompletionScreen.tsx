import React from 'react';
import Link from 'next/link';
import { Button, GlassCard } from '@/components/ui';

interface CompletionScreenProps {
    isSRS: boolean;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({ isSRS }) => {
    const title = isSRS ? "All Caught Up!" : "Practice Session Complete!";
    const message = isSRS
        ? "You've finished all your scheduled reviews for this source. Excellence in diligence!"
        : "You've reached the end of this session. Would you like to study more or return to your library?";
    const icon = isSRS ? "📜" : "✨";

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 animate-in fade-in zoom-in duration-700">
            <div className="relative mb-12">
                <div className="w-32 h-32 bg-accent-gold/10 rounded-full flex items-center justify-center text-6xl animate-pulse relative z-10 shadow-2xl shadow-accent-gold/20 border border-accent-gold/20">
                    {icon}
                </div>
                <div className="absolute inset-0 bg-accent-gold/5 rounded-full blur-3xl -z-10 animate-pulse scale-150" />
            </div>

            <h2 className="text-4xl md:text-5xl font-display font-bold text-text-primary mb-4 text-center">
                {title}
            </h2>
            <p className="text-text-secondary text-lg mb-12 max-w-md text-center leading-relaxed italic opacity-80">
                "{message}"
            </p>

            <div className="flex flex-col gap-4 w-full max-w-sm">
                <Link href="/dashboard" className="w-full">
                    <Button size="lg" className="w-full py-5 text-xl">
                        Back to Dashboard
                    </Button>
                </Link>
                {!isSRS && (
                    <Button
                        variant="secondary"
                        size="lg"
                        className="w-full py-5 text-xl"
                        onClick={() => window.location.reload()}
                    >
                        Begin Fresh Session
                    </Button>
                )}
            </div>
        </div>
    );
};
