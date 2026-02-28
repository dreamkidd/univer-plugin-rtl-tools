/**
 * Regular expression for detecting Right-to-Left (RTL) language characters.
 *
 * Precise Unicode ranges:
 *   Hebrew:               0590-05FF
 *   Arabic:               0600-06FF
 *   Syriac:               0700-074F
 *   Arabic Supplement:     0750-077F
 *   Thaana:               0780-07BF
 *   Arabic Extended-A:     08A0-08FF
 *   Hebrew Presentation:   FB1D-FB4F
 *   Arabic Presentation A: FB50-FDFF
 *   Arabic Presentation B: FE70-FEFF
 */
const RTL_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u08A0-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Checks if a given string contains RTL characters.
 * @param text The string to check
 * @returns True if RTL characters are found
 */
export function hasRTLCharacters(text: string): boolean {
    if (!text) return false;
    return RTL_REGEX.test(text);
}

/**
 * Calculates the ratio of RTL characters in a string (0.0 to 1.0).
 * Whitespace, digits, and common punctuation are excluded from the count.
 * @param text The string to check
 * @returns Ratio of RTL characters (0.0 to 1.0)
 */
export function getRTLPercentage(text: string): number {
    if (!text || text.length === 0) return 0;

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
 */
export function isRTLDominant(text: string, threshold: number = 0.3): boolean {
    return getRTLPercentage(text) > threshold;
}

/**
 * Returns the direction of the first strong directional character in the text.
 * This matches Excel's "Context" / readingOrder=0 behavior.
 *
 * RTL strong chars:
 *   Hebrew: 0590-05FF, Arabic/Syriac/Thaana: 0600-07FF
 *   Hebrew/Arabic Presentation: FB1D-FDFF, Arabic Presentation B: FE70-FEFC
 *
 * LTR strong chars:
 *   Basic Latin A-Z/a-z: 0041-005A, 0061-007A
 *   Latin Extended: 00C0-024F
 *   CJK Unified Ideographs: 4E00-9FFF
 *   CJK Extension A: 3400-4DBF, Compatibility: F900-FAFF
 *
 * @param text The string to check
 * @returns 'rtl' if first strong char is RTL, 'ltr' if LTR, null if no strong chars found
 */
export function getFirstStrongDirection(text: string): 'ltr' | 'rtl' | null {
    if (!text) return null;

    for (let i = 0; i < text.length; i++) {
        const cp = text.charCodeAt(i);

        // RTL strong characters
        if (
            (cp >= 0x0590 && cp <= 0x05FF) || // Hebrew
            (cp >= 0x0600 && cp <= 0x07FF) || // Arabic, Syriac, Thaana
            (cp >= 0xFB1D && cp <= 0xFDFF) || // Hebrew/Arabic Presentation A
            (cp >= 0xFE70 && cp <= 0xFEFC)    // Arabic Presentation B
        ) {
            return 'rtl';
        }

        // LTR strong characters
        if (
            (cp >= 0x0041 && cp <= 0x005A) || // Latin uppercase A-Z
            (cp >= 0x0061 && cp <= 0x007A) || // Latin lowercase a-z
            (cp >= 0x00C0 && cp <= 0x024F) || // Latin Extended
            (cp >= 0x3400 && cp <= 0x4DBF) || // CJK Extension A
            (cp >= 0x4E00 && cp <= 0x9FFF) || // CJK Unified Ideographs
            (cp >= 0xF900 && cp <= 0xFAFF)    // CJK Compatibility Ideographs
        ) {
            return 'ltr';
        }
    }

    return null;
}
