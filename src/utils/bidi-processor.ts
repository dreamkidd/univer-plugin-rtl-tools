import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

export interface TextRun {
    text: string;
    direction: 'ltr' | 'rtl';
    level: number;
}

/**
 * Reverses a string while preserving grapheme clusters (combining characters, surrogate pairs).
 * Uses Intl.Segmenter when available, falls back to Array.from for surrogate pair safety.
 */
export function reverseGraphemes(text: string): string {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        return [...segmenter.segment(text)].map(s => s.segment).reverse().join('');
    }
    return Array.from(text).reverse().join('');
}

/**
 * Processes a logical string (how it's typed/stored) and converts it into
 * an array of visual text runs, correctly ordered from left to right for rendering on a Canvas.
 *
 * Uses the Unicode Bidirectional Algorithm via bidi-js:
 * 1. getEmbeddingLevels → returns { levels: Uint8Array, paragraphs: [...] }
 * 2. getReorderSegments → returns flip ranges to reverse in-place for visual ordering
 * 3. Build text runs grouped by embedding level from the reordered indices
 *
 * @param logicalText The raw string from the Univer cell model
 * @param baseDirection The overall direction of the paragraph (can be forced or auto-detected)
 * @returns An array of TextRun objects sorted in visual (left-to-right Canvas) order
 */
export function getVisualTextRuns(logicalText: string, baseDirection: 'ltr' | 'rtl' | 'auto' = 'auto'): TextRun[] {
    if (!logicalText) {
        return [];
    }

    // 1. Get embedding levels for each character.
    // Returns { levels: Uint8Array, paragraphs: [{start, end, level}] }
    const embeddingLevelsResult = bidi.getEmbeddingLevels(logicalText, baseDirection);
    const { levels } = embeddingLevelsResult;

    // 2. Get flip segments — ranges to reverse in-place for visual reordering.
    // Each flip is [start, end] (inclusive) to be reversed in order.
    const flips = bidi.getReorderSegments(logicalText, embeddingLevelsResult);

    // 3. Build an index array and apply flips to get visual ordering of characters.
    const indices = Array.from({ length: logicalText.length }, (_, i) => i);
    for (const [start, end] of flips) {
        let left = start;
        let right = end;
        while (left < right) {
            const tmp = indices[left];
            indices[left] = indices[right];
            indices[right] = tmp;
            left++;
            right--;
        }
    }

    // 4. Walk the visually-ordered indices and group consecutive characters
    //    with the same embedding level into text runs.
    if (indices.length === 0) {
        return [];
    }

    const textRuns: TextRun[] = [];
    let runStartIdx = 0;
    let runLevel = levels[indices[0]];

    for (let i = 1; i <= indices.length; i++) {
        const currentLevel = i < indices.length ? levels[indices[i]] : -1;

        if (currentLevel !== runLevel) {
            // Collect characters for this run
            let runText = '';
            for (let j = runStartIdx; j < i; j++) {
                runText += logicalText[indices[j]];
            }

            const isRtl = runLevel % 2 !== 0;
            textRuns.push({
                text: runText,
                direction: isRtl ? 'rtl' : 'ltr',
                level: runLevel,
            });

            runStartIdx = i;
            runLevel = currentLevel;
        }
    }

    return textRuns;
}
