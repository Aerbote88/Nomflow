'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { loadCharacter, type CharacterData } from '@/lib/strokeData';

type Props = {
    character: string;
    size?: number;
    onUnavailable?: () => void;
};

type HanziWriterInstance = {
    animateCharacter: (opts?: {
        onComplete?: (summary: { canceled: boolean }) => void;
    }) => void;
    quiz: (opts?: {
        showOutline?: boolean;
        leniency?: number;
        onComplete?: (summary: { totalMistakes: number }) => void;
    }) => void;
    cancelQuiz?: () => void;
    showOutline: () => void;
    hideOutline: () => void;
    showCharacter: () => void;
    hideCharacter: () => void;
    updateColor: (type: string, color: string, opts?: { duration?: number }) => void;
};

export function CharacterWriter({ character, size = 320, onUnavailable }: Props) {
    const hostRef = useRef<HTMLDivElement>(null);
    const writerRef = useRef<HanziWriterInstance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const [succeeded, setSucceeded] = useState(false);
    const [mistakes, setMistakes] = useState(0);

    const startQuiz = () => {
        const w = writerRef.current;
        if (!w) return;
        w.hideOutline();
        w.updateColor('drawingColor', '#ffad1d', { duration: 0 });
        setSucceeded(false);
        setMistakes(0);
        w.quiz({
            showOutline: false,
            leniency: 1.3,
            onComplete: (summary) => {
                setMistakes(summary.totalMistakes);
                setSucceeded(true);
                w.updateColor('drawingColor', '#4ade80', { duration: 300 });
            },
        });
    };

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setUnavailable(false);
        setSucceeded(false);
        setMistakes(0);

        (async () => {
            try {
                const data = await loadCharacter(character);
                if (cancelled) return;
                if (!data) {
                    setUnavailable(true);
                    setLoading(false);
                    onUnavailable?.();
                    return;
                }
                const mod = await import('hanzi-writer');
                if (cancelled) return;
                const HanziWriter = mod.default;
                if (!hostRef.current) return;
                hostRef.current.innerHTML = '';
                writerRef.current = HanziWriter.create(hostRef.current, character, {
                    width: size,
                    height: size,
                    padding: 12,
                    strokeColor: '#fafafa',
                    radicalColor: '#ffad1d',
                    outlineColor: '#3f3f46',
                    drawingColor: '#ffad1d',
                    strokeAnimationSpeed: 1.6,
                    delayBetweenStrokes: 80,
                    showOutline: false,
                    showCharacter: false,
                    charDataLoader: (
                        _ch: string,
                        onComplete: (d: CharacterData) => void,
                    ) => onComplete(data),
                }) as unknown as HanziWriterInstance;
                const svg = hostRef.current.querySelector('svg');
                if (svg) {
                    svg.style.transform = `translateY(-${Math.round(size * 0.05)}px)`;
                }
                setLoading(false);
                startQuiz();
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : String(err));
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            try {
                writerRef.current?.cancelQuiz?.();
            } catch {}
        };
    }, [character, size, onUnavailable]);

    const animate = () => {
        const w = writerRef.current;
        if (!w) return;
        w.cancelQuiz?.();
        setSucceeded(false);
        w.updateColor('drawingColor', '#ffad1d', { duration: 0 });
        w.animateCharacter({
            onComplete: ({ canceled }) => {
                if (canceled) return;
                setTimeout(() => {
                    if (writerRef.current !== w) return;
                    w.hideCharacter();
                    startQuiz();
                }, 700);
            },
        });
    };
    const peek = () => {
        const w = writerRef.current;
        if (!w) return;
        w.showOutline();
        setTimeout(() => w.hideOutline(), 900);
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative">
                <div
                    ref={hostRef}
                    className={`rounded-xl border-2 bg-white/5 transition-all duration-500 ${
                        succeeded
                            ? 'border-green-400 shadow-[0_0_40px_rgba(74,222,128,0.5)]'
                            : 'border-accent-gold/20'
                    }`}
                    style={{ width: size, height: size }}
                />
                {succeeded && (
                    <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-green-500 text-white text-xs font-bold uppercase tracking-widest shadow-lg animate-in fade-in zoom-in duration-300">
                        ✓ {mistakes === 0 ? 'Perfect!' : 'Correct'}
                    </div>
                )}
            </div>
            {loading && !unavailable && (
                <div className="text-text-secondary text-sm">Loading…</div>
            )}
            {unavailable && (
                <div className="text-text-secondary text-sm max-w-xs text-center">
                    No stroke data for <span className="font-nom text-base">{character}</span>
                </div>
            )}
            {error && (
                <div className="text-red-400 text-sm max-w-xs text-center">{error}</div>
            )}
            <div className="flex gap-3">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={animate}
                    disabled={loading || !!error || unavailable}
                >
                    Animate
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={peek}
                    disabled={loading || !!error || unavailable}
                >
                    Hint
                </Button>
            </div>
        </div>
    );
}
