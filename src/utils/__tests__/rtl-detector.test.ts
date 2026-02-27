import { describe, it, expect } from 'vitest';
import { hasRTLCharacters, getRTLPercentage, isRTLDominant } from '../rtl-detector';

describe('hasRTLCharacters', () => {
    it('returns false for empty/null input', () => {
        expect(hasRTLCharacters('')).toBe(false);
        expect(hasRTLCharacters(null as any)).toBe(false);
        expect(hasRTLCharacters(undefined as any)).toBe(false);
    });

    it('returns false for pure LTR text', () => {
        expect(hasRTLCharacters('Hello World')).toBe(false);
        expect(hasRTLCharacters('12345')).toBe(false);
        expect(hasRTLCharacters('abc 123 !@#')).toBe(false);
    });

    it('detects Arabic text', () => {
        expect(hasRTLCharacters('مرحبا')).toBe(true);
        expect(hasRTLCharacters('Hello مرحبا World')).toBe(true);
    });

    it('detects Hebrew text', () => {
        expect(hasRTLCharacters('שלום')).toBe(true);
        expect(hasRTLCharacters('Hello שלום World')).toBe(true);
    });

    it('detects Persian text', () => {
        expect(hasRTLCharacters('سلام')).toBe(true);
    });

    it('detects Thaana text', () => {
        // Thaana character (U+0780)
        expect(hasRTLCharacters('\u0780')).toBe(true);
    });

    it('detects Syriac text', () => {
        // Syriac character (U+0710)
        expect(hasRTLCharacters('\u0710')).toBe(true);
    });

    it('does not false-positive on Ethiopic (excluded from RTL range)', () => {
        // Ethiopic U+1200 should not match
        expect(hasRTLCharacters('\u1200')).toBe(false);
    });
});

describe('getRTLPercentage', () => {
    it('returns 0 for empty input', () => {
        expect(getRTLPercentage('')).toBe(0);
        expect(getRTLPercentage(null as any)).toBe(0);
    });

    it('returns 0 for pure LTR text', () => {
        expect(getRTLPercentage('Hello')).toBe(0);
    });

    it('returns 1 for pure Arabic text', () => {
        expect(getRTLPercentage('مرحبا')).toBe(1);
    });

    it('returns ~0.5 for mixed text', () => {
        // 5 Arabic chars + 5 Latin chars
        const pct = getRTLPercentage('مرحبا Hello');
        expect(pct).toBeGreaterThan(0.4);
        expect(pct).toBeLessThan(0.6);
    });

    it('ignores whitespace and digits in calculation', () => {
        // Only Arabic letter chars count, spaces/digits excluded
        const pct = getRTLPercentage('123 مرحبا 456');
        expect(pct).toBe(1); // only Arabic letters remain after stripping
    });

    it('returns 0 for string of only punctuation/spaces', () => {
        expect(getRTLPercentage('   ...!!!   ')).toBe(0);
    });
});

describe('isRTLDominant', () => {
    it('returns true when RTL ratio exceeds threshold', () => {
        expect(isRTLDominant('مرحبا بالعالم')).toBe(true);
    });

    it('returns false when RTL ratio is below threshold', () => {
        expect(isRTLDominant('Hello World with one م')).toBe(false);
    });

    it('supports custom threshold', () => {
        // Pure Arabic should pass any threshold
        expect(isRTLDominant('مرحبا', 0.9)).toBe(true);
        // Pure LTR should fail any threshold
        expect(isRTLDominant('Hello', 0.1)).toBe(false);
    });
});
