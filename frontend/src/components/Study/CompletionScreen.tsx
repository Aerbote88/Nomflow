'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';

interface CompletionScreenProps {
    isSRS: boolean;
    isGuest?: boolean;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({ isSRS, isGuest = false }) => {
    const t = useTranslations('completion');
    const title = isSRS ? t('caughtUpTitle') : t('completeTitle');
    const message = isSRS ? t('caughtUpBody') : t('completeBody');

    return (
        <div className="flex flex-col items-center justify-center py-8 w-full max-w-sm mx-auto">
            <h2 className="text-3xl font-display font-bold text-text-primary mb-2 text-center">
                {title}
            </h2>
            <p className="text-text-secondary mb-8 text-center leading-relaxed opacity-80">
                {message}
            </p>

            <div className="flex flex-col gap-3 w-full">
                {!isSRS && (
                    <Button
                        size="lg"
                        className="w-full shadow-lg shadow-accent-primary/20"
                        onClick={() => window.location.reload()}
                    >
                        {t('goAgain')}
                    </Button>
                )}
                {!isGuest && (
                    <>
                        <Link href="/dashboard" className="w-full">
                            <Button size="lg" variant={isSRS ? 'primary' : 'secondary'} className="w-full">
                                {t('backDashboard')}
                            </Button>
                        </Link>
                        <Link href="/library" className="w-full">
                            <Button size="lg" variant={isSRS ? 'secondary' : 'ghost'} className="w-full">
                                {t('goToLibrary')}
                            </Button>
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
};
