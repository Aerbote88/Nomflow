import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';

interface CompletionScreenProps {
    isSRS: boolean;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({ isSRS }) => {
    const title = isSRS ? "All Caught Up!" : "Session Complete!";
    const message = isSRS
        ? "You've finished all your scheduled reviews for this source."
        : "You've finished this practice session. What would you like to do next?";

    return (
        <div className="flex flex-col items-center justify-center py-8 w-full max-w-sm mx-auto">
            <h2 className="text-3xl font-display font-bold text-text-primary mb-2 text-center">
                {title}
            </h2>
            <p className="text-text-secondary mb-8 text-center leading-relaxed opacity-80">
                {message}
            </p>

            <div className="flex flex-col gap-3 w-full">
                {!isSRS ? (
                    <>
                        <Button
                            size="lg"
                            className="w-full shadow-lg shadow-accent-primary/20"
                            onClick={() => window.location.reload()}
                        >
                            Go Again
                        </Button>
                        <Link href="/dashboard" className="w-full">
                            <Button size="lg" variant="secondary" className="w-full">
                                Back to Dashboard
                            </Button>
                        </Link>
                        <Link href="/library" className="w-full">
                            <Button size="lg" variant="ghost" className="w-full">
                                Go to Library
                            </Button>
                        </Link>
                    </>
                ) : (
                    <>
                        <Link href="/dashboard" className="w-full">
                            <Button size="lg" className="w-full">
                                Back to Dashboard
                            </Button>
                        </Link>
                        <Link href="/library" className="w-full">
                            <Button size="lg" variant="secondary" className="w-full">
                                Go to Library
                            </Button>
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
};
