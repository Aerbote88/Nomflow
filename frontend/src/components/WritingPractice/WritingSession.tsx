'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { CharacterWriter } from './CharacterWriter';
import { loadCharacter } from '@/lib/strokeData';
import type { WritingEntry } from '@/app/writing-practice/page';

type Props = {
    entries: WritingEntry[];
    title: string;
};

function LineWithHighlight({ line, target }: { line: string; target: string }) {
    const chars = Array.from(line);
    let masked = false;
    return (
        <span className="font-nom text-xl sm:text-2xl leading-relaxed">
            {chars.map((ch, i) => {
                const isTarget = !masked && ch === target;
                if (isTarget) {
                    masked = true;
                    return (
                        <span
                            key={i}
                            className="inline-flex items-center justify-center align-middle -translate-y-1 mx-0.5 sm:mx-1 w-6 h-6 sm:w-8 sm:h-8 rounded-md border-2 border-dashed border-accent-primary bg-accent-primary/10 text-transparent select-none"
                            aria-label="hidden character"
                        >
                            {ch}
                        </span>
                    );
                }
                return (
                    <span key={i} className="text-text-primary">
                        {ch}
                    </span>
                );
            })}
        </span>
    );
}

export function WritingSession({ entries, title }: Props) {
    const [index, setIndex] = useState(0);
    const advanceTimerRef = useRef<number | null>(null);

    const clearTimer = () => {
        if (advanceTimerRef.current !== null) {
            window.clearTimeout(advanceTimerRef.current);
            advanceTimerRef.current = null;
        }
    };

    useEffect(() => {
        return () => clearTimer();
    }, []);

    // Prefetch stroke data for the characters immediately around the current
    // index so navigating forward/back is instant once the user gets rolling.
    useEffect(() => {
        if (entries.length === 0) return;
        const windowSize = 5;
        const start = Math.max(0, index - 1);
        const end = Math.min(entries.length, index + windowSize);
        for (let i = start; i < end; i++) {
            loadCharacter(entries[i].character).catch(() => {});
        }
    }, [index, entries]);

    const next = useCallback(() => {
        clearTimer();
        setIndex((i) => Math.min(entries.length - 1, i + 1));
    }, [entries.length]);

    const prev = () => {
        clearTimer();
        setIndex((i) => Math.max(0, i - 1));
    };

    const handleSuccess = useCallback(() => {
        clearTimer();
        advanceTimerRef.current = window.setTimeout(() => {
            advanceTimerRef.current = null;
            setIndex((i) => Math.min(entries.length - 1, i + 1));
        }, 1200);
    }, [entries.length]);

    if (!entries || entries.length === 0) {
        return (
            <div className="glass-card text-center py-12">
                <p className="text-text-secondary">No characters to practice in this text.</p>
            </div>
        );
    }

    const current = entries[index];

    return (
        <div className="flex flex-col items-center gap-3 sm:gap-6">
            <div className="text-center">
                <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] sm:tracking-[0.3em] text-accent-primary/80">
                    Unique characters in
                </div>
                <h2 className="text-lg sm:text-xl font-display font-bold text-text-primary mt-0.5 sm:mt-1">
                    {title}
                </h2>
                <p className="text-text-secondary text-xs sm:text-sm mt-1 sm:mt-2">
                    Character {index + 1} of {entries.length}
                </p>
            </div>

            <CharacterWriter
                character={current.character}
                quocNgu={current.character_quoc_ngu}
                onSuccess={handleSuccess}
            />

            <div className="glass-card w-full max-w-xl text-center px-3 py-2 sm:px-4 sm:py-3">
                <div className="text-[9px] uppercase tracking-widest text-text-secondary mb-1">
                    Line {current.line_number}
                </div>
                <LineWithHighlight line={current.line_nom} target={current.character} />
                <div className="text-text-secondary italic mt-1 text-xs">
                    {current.line_quoc_ngu}
                </div>
            </div>

            <div className="flex gap-3 sm:gap-6 items-center">
                <Button variant="ghost" size="sm" onClick={prev} disabled={index === 0}>
                    ← Prev
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={next}
                    disabled={index === entries.length - 1}
                >
                    Next →
                </Button>
            </div>
        </div>
    );
}
