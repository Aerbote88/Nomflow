import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';

interface StudyHeaderProps {
    mode: string;
    progress: string;
    title?: string;
}

export const StudyHeader: React.FC<StudyHeaderProps> = ({ mode, progress, title = "Study Session" }) => {
    return (
        <div className="flex justify-between items-center mb-6 w-full max-w-[600px] mx-auto">
            <div className="flex items-center gap-3">
                <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="!px-2 !py-1 text-text-secondary hover:text-text-primary gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="text-[10px] font-black uppercase tracking-widest">Exit</span>
                    </Button>
                </Link>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-accent-primary uppercase tracking-[0.2em] leading-none mb-0.5">
                        {mode === 'srs' ? 'SRS Review' : mode === 'random' ? 'Random' : 'Custom Study'}
                    </span>
                    <span className="text-xs font-bold text-text-primary uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
                        {progress}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-emerald-500 uppercase tracking-widest font-black flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Progress Saved
                    </span>
                    {title && <span className="text-[9px] text-text-secondary uppercase tracking-tight opacity-50 truncate max-w-[120px]">{title}</span>}
                </div>
            </div>
        </div>
    );
};
