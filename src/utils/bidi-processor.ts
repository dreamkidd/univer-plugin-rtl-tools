import bidiFactory from 'bidi-js';

// Initialize the bidi engine. 
// Note: In a production environment, this might be loaded asynchronously depending on the bidi-js version.
const bidi = bidiFactory();

export interface TextRun {
    text: string;
    direction: 'ltr' | 'rtl';
    level: number;
}

/**
 * Processes a logical string (how it's typed/stored) and converts it into 
 * an array of visual text runs, correctly ordered from left to right for rendering on a Canvas.
 * 
 * @param logicalText The raw string from the Univer cell model
 * @param baseDirection The overall direction of the paragraph (can be forced or auto-detected)
 * @returns An array of TextRun objects sorted in visual (left-to-right Canvas) order
 */
export function getVisualTextRuns(logicalText: string, baseDirection: 'ltr' | 'rtl' | 'auto' = 'auto'): TextRun[] {
    if (!logicalText) {
        return [];
    }

    // 1. Get the embedding levels for each character
    // The bidi algorithm assigns an embedding level to each character.
    // Even levels (0, 2...) are LTR, odd levels (1, 3...) are RTL.
    const embeddingLevels = bidi.getEmbeddingLevels(logicalText, baseDirection);

    // 2. Reorder the string based on the embedding levels to get the visual order
    // bidi-js provides a method to get the visual ordering of characters
    // 'reorderVisual' returns an array of logical indices in their final visual order.
    // e.g., if logical is "abc(ARABIC)def", it might return [0,1,2, 9,8,7,6,5,4,3, 10,11,12]
    const visualOrdering = bidi.getReorderSegments(logicalText, embeddingLevels);

    const textRuns: TextRun[] = [];

    // 3. Construct the text runs
    // A run is a contiguous sequence of characters with the same embedding level and direction.
    for (const segment of visualOrdering) {
        // segment: [start_index, end_index] from the logical text, representing a directional run
        const start = segment[0];
        const end = segment[1];
        
        // Extract the substring for this run
        let runText = logicalText.substring(start, end + 1);
        
        // The level of this segment determines its direction
        const level = embeddingLevels[start];
        const isRtl = level % 2 !== 0;

        // If it's an RTL run, the characters within this segment need to be reversed visually
        // because Canvas fillText (when drawing LTR) draws the first character of the string first (leftmost).
        // Since it's RTL, the logical first character should be drawn rightmost within this run.
        if (isRtl) {
            runText = runText.split('').reverse().join('');
        }

        textRuns.push({
            text: runText,
            direction: isRtl ? 'rtl' : 'ltr',
            level: level
        });
    }

    // Because 'getReorderSegments' usually returns segments in visual order (left to right)
    // we can return the array directly. The Canvas rendering engine will just iterate
    // through this array and draw them one after another from left to right.
    return textRuns;
}