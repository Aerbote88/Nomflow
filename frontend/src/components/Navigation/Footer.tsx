'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FeedbackModal } from './FeedbackModal';

export function Footer() {
    const t = useTranslations('footer');
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    return (
        <>
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
            <footer className="text-center py-8 px-4 mt-8 border-t border-accent-gold/10 text-text-secondary text-sm shrink-0">
                <div className="mb-1 font-semibold">{t('version')}</div>
                <div className="opacity-80">
                    {t.rich('createdBy', {
                        link: (chunks) => (
                            <a
                                href="https://www.alberterrickson.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent-primary hover:text-accent-hover transition-colors font-medium"
                            >
                                {chunks}
                            </a>
                        ),
                    })}
                </div>
                <div className="opacity-80">
                    {t.rich('partOf', {
                        link: (chunks) => (
                            <a
                                href="https://www.digitizingvietnam.com/en"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent-primary hover:text-accent-hover transition-colors font-medium"
                            >
                                {chunks}
                            </a>
                        ),
                    })}
                </div>
                <p className="mt-4 text-xs text-text-secondary/50">
                    {t('feedbackPrompt')}{' '}
                    <button
                        onClick={() => setFeedbackOpen(true)}
                        className="font-bold text-accent-primary/60 hover:text-accent-primary transition-colors"
                    >
                        {t('submitFeedback')}
                    </button>
                </p>
            </footer>
        </>
    );
}
