'use client';

import React, { useState } from 'react';
import { FeedbackModal } from './FeedbackModal';

export function Footer() {
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    return (
        <>
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
            <footer className="text-center py-8 px-4 mt-8 border-t border-accent-gold/10 text-text-secondary text-sm shrink-0">
                <div className="mb-1 font-semibold">NômFlow — Beta Version 1.0</div>
                <div className="opacity-80">
                    Created by{' '}
                    <a href="https://columbia.academia.edu/AlbertErrickson" target="_blank" rel="noopener noreferrer"
                        className="text-accent-primary hover:text-accent-hover transition-colors font-medium">
                        Albert Errickson
                    </a>
                </div>
                <div className="opacity-80">
                    Part of{' '}
                    <a href="https://www.digitizingvietnam.com/en" target="_blank" rel="noopener noreferrer"
                        className="text-accent-primary hover:text-accent-hover transition-colors font-medium">
                        Digitizing Vietnam
                    </a>
                </div>
                <p className="mt-4 text-xs text-text-secondary/50">
                    Comment? Found a bug?{' '}
                    <button
                        onClick={() => setFeedbackOpen(true)}
                        className="font-bold text-accent-primary/60 hover:text-accent-primary transition-colors"
                    >
                        Submit Feedback.
                    </button>
                </p>
            </footer>
        </>
    );
}
