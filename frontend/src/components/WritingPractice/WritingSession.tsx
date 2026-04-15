'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { CharacterWriter } from './CharacterWriter';
import type { WritingEntry } from '@/app/writing-practice/page';

type Props = {
    entries: WritingEntry[];
    title: string;
};

function LineWithHighlight({ line, target }: { line: string; target: string }) {
    const chars = Array.from(line);
    let masked = false;
    return (
        <span className="font-nom text-2xl leading-relaxed">
            {chars.map((ch, i) => {
                const isTarget = !masked && ch === target;
                if (isTarget) {
                    masked = true;
                    return (
                        <span
                            key={i}
                            className="inline-flex items-center justify-center align-middle mx-1 w-8 h-8 rounded-md border-2 border-dashed border-accent-primary bg-accent-primary/10 text-transparent select-none"
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

    if (!entries || entries.length === 0) {
        return (
            <div className="glass-card text-center py-12">
                <p className="text-text-secondary">No characters to practice in this text.</p>
            </div>
        );
    }

    const current = entries[index];
    const prev = () => setIndex((i) => Math.max(0, i - 1));
    const next = () => setIndex((i) => Math.min(entries.length - 1, i + 1));

    return (
        <div className="flex flex-col items-center gap-6">
            <div className="text-center">
                <h2 className="text-xl font-display font-bold text-text-primary">{title}</h2>
                <p className="text-text-secondary text-sm mt-1">
                    {index + 1} / {entries.length}
                </p>
            </div>

            <CharacterWriter key={`${index}-${current.character}`} character={current.character} />

            <div className="glass-card w-full max-w-xl text-center py-4">
                <div className="text-[10px] uppercase tracking-widest text-text-secondary mb-2">
                    Line {current.line_number}
                </div>
                <LineWithHighlight line={current.line_nom} target={current.character} />
                <div className="text-text-secondary italic mt-2 text-sm">
                    {current.line_quoc_ngu}
                </div>
            </div>

            <div className="flex gap-6 items-center">
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
