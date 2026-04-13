'use client';

import React from 'react';

interface DictionaryPanelProps {
    mobileOpen: boolean;
    desktopOpen: boolean;
    onClose: () => void;
    /**
     * 'floating' — absolute-positioned to the right of a centered container (library/study/flashcards)
     * 'sidebar'  — static flex sibling inside a flex row (reader page)
     */
    variant: 'floating' | 'sidebar';
    /** For 'floating': pixels right of the container's centerline. Defaults to 510 (max-w-[1000px]). */
    floatingOffsetPx?: number;
    children: React.ReactNode;
}

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export function DictionaryPanel({ mobileOpen, desktopOpen, onClose, variant, floatingOffsetPx = 510, children }: DictionaryPanelProps) {
    const desktopAsideClass =
        variant === 'floating'
            ? 'hidden lg:block absolute top-8 max-h-[calc(100vh-14rem)] z-[70] w-72 bg-bg-primary/90 backdrop-blur-xl border-l border-white/10 overflow-y-auto px-4 animate-in slide-in-from-right duration-300'
            : 'hidden lg:block lg:static lg:w-72 shrink-0 overflow-y-auto';
    const desktopStyle = variant === 'floating' ? { left: `calc(50% + ${floatingOffsetPx}px)` } : undefined;

    return (
        <>
            {/* Desktop */}
            {desktopOpen && (
                <aside className={desktopAsideClass} style={desktopStyle}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.3em]">
                            Dictionary
                        </div>
                        {variant === 'floating' && (
                            <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
                                <CloseIcon />
                            </button>
                        )}
                    </div>
                    {children}
                </aside>
            )}

            {/* Mobile centered modal */}
            {mobileOpen && (
            <div
                className="lg:hidden fixed inset-0 z-[110] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-sm max-h-[85vh] flex flex-col bg-bg-primary/95 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-300 shadow-2xl"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                        <div className="text-[10px] font-black text-accent-primary uppercase tracking-[0.3em]">
                            Dictionary
                        </div>
                        <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
                            <CloseIcon />
                        </button>
                    </div>
                    <div className="overflow-y-auto px-4 py-4 flex-1">{children}</div>
                </div>
            </div>
            )}
        </>
    );
}
