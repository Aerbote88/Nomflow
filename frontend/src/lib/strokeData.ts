export type CharacterData = {
    character: string;
    strokes: string[];
    medians: number[][][];
};

const CACHE = new Map<string, CharacterData | null>();

export async function loadCharacter(character: string): Promise<CharacterData | null> {
    if (CACHE.has(character)) return CACHE.get(character) ?? null;

    const codepoint = character.codePointAt(0);
    if (codepoint === undefined) {
        CACHE.set(character, null);
        return null;
    }

    const res = await fetch(`/api/characters/strokes/${codepoint}`);
    if (res.status === 404) {
        CACHE.set(character, null);
        return null;
    }
    if (!res.ok) {
        throw new Error(`Failed to load stroke data for ${character} (${res.status})`);
    }

    const data = (await res.json()) as CharacterData;
    CACHE.set(character, data);
    return data;
}
