/**
 * Regular expressions for detecting Right-to-Left (RTL) language characters.
 * Covers Arabic, Persian, Hebrew, Syriac, Thaana, and other RTL unicode blocks.
 */
const RTL_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

/**
 * Checks if a given string contains RTL characters.
 * @param text The string to check
 * @returns boolean True if RTL characters are found
 */
export function hasRTLCharacters(text: string): boolean {
    if (!text) return false;
    return RTL_REGEX.test(text);
}

/**
 * Calculates the percentage of RTL characters in a string.
 * Useful for determining if the overall context is RTL when mixed with LTR.
 * @param text The string to check
 * @returns number Percentage of RTL characters (0.0 to 1.0)
 */
export function getRTLPercentage(text: string): number {
    if (!text || text.length === 0) return 0;
    
    // Remove whitespace and common punctuations for accurate ratio
    const strippedText = text.replace(/[\s\d.,!?;:()\[\]{}"'-]/g, '');
    if (strippedText.length === 0) return 0;

    let rtlCount = 0;
    for (let i = 0; i < strippedText.length; i++) {
        if (RTL_REGEX.test(strippedText[i])) {
            rtlCount++;
        }
    }

    return rtlCount / strippedText.length;
}

/**
 * Determines if a string should be considered RTL based on a threshold.
 * @param text The string to check
 * @param threshold The ratio threshold (default 0.3 means if >30% is RTL, treat as RTL)
 * @returns boolean
 */
export function isRTLDominant(text: string, threshold: number = 0.3): boolean {
    return getRTLPercentage(text) > threshold;
}