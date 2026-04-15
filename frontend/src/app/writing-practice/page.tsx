'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { WritingSession } from '@/components/WritingPractice/WritingSession';

type SourceText = {
    id: number;
    title: string;
    author?: string;
};

export type WritingEntry = {
    character: string;
    line_nom: string;
    line_quoc_ngu: string;
    line_number: number;
};

type TextCharacterSequence = {
    title: string;
    entries: WritingEntry[];
};

function SourcePicker() {
    const [texts, setTexts] = useState<SourceText[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiFetch<SourceText[]>('texts')
            .then(setTexts)
            .catch((e) => setError(e.message));
    }, []);

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-display font-bold text-text-primary text-center mb-2">
                Writing Practice
            </h1>
            <p className="text-text-secondary text-center mb-8">
                Trace Nôm characters with proper stroke order. Pick a text to practice.
            </p>

            {error && (
                <div className="text-red-400 text-sm text-center mb-4">{error}</div>
            )}

            <div className="flex flex-col gap-2">
                {texts === null && <p className="text-text-secondary text-center">Loading…</p>}
                {texts && texts.length === 0 && (
                    <p className="text-text-secondary text-center">No texts available.</p>
                )}
                {texts?.map((t) => (
                    <Link
                        key={t.id}
                        href={`/writing-practice?text_id=${t.id}`}
                        className="glass-card flex items-center justify-between px-4 py-3 hover:border-accent-primary/40 transition-all"
                    >
                        <div>
                            <div className="text-text-primary font-semibold">{t.title}</div>
                            {t.author && (
                                <div className="text-text-secondary text-sm">{t.author}</div>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

function SessionLoader({ textId }: { textId: string }) {
    const [entries, setEntries] = useState<WritingEntry[] | null>(null);
    const [title, setTitle] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const seq = await apiFetch<TextCharacterSequence>(`texts/${textId}/characters`);
                if (cancelled) return;
                setEntries(seq.entries);
                setTitle(seq.title);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [textId]);

    if (error) {
        return (
            <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <Link href="/writing-practice" className="text-accent-primary underline">
                    ← Back
                </Link>
            </div>
        );
    }

    if (entries === null) {
        return <p className="text-text-secondary text-center">Loading…</p>;
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-4">
                <Link
                    href="/writing-practice"
                    className="text-text-secondary text-sm hover:text-accent-primary transition-colors"
                >
                    ← Change text
                </Link>
            </div>
            <WritingSession entries={entries} title={title} />
        </div>
    );
}

function WritingPracticeContent() {
    const searchParams = useSearchParams();
    const textId = searchParams.get('text_id');

    if (!textId) {
        return <SourcePicker />;
    }
    return <SessionLoader key={textId} textId={textId} />;
}

export default function WritingPracticePage() {
    return (
        <Suspense fallback={<p className="text-text-secondary text-center">Loading…</p>}>
            <WritingPracticeContent />
        </Suspense>
    );
}
