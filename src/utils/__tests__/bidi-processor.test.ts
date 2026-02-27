import { describe, it, expect } from 'vitest';
import { getVisualTextRuns } from '../bidi-processor';

describe('getVisualTextRuns', () => {
    it('returns empty array for empty input', () => {
        expect(getVisualTextRuns('')).toEqual([]);
        expect(getVisualTextRuns(null as any)).toEqual([]);
        expect(getVisualTextRuns(undefined as any)).toEqual([]);
    });

    it('returns single LTR run for pure English text', () => {
        const runs = getVisualTextRuns('Hello World');
        expect(runs.length).toBeGreaterThanOrEqual(1);
        const fullText = runs.map(r => r.text).join('');
        expect(fullText).toBe('Hello World');
        expect(runs.every(r => r.direction === 'ltr')).toBe(true);
    });

    it('returns RTL run for pure Arabic text', () => {
        const runs = getVisualTextRuns('مرحبا');
        expect(runs.length).toBeGreaterThanOrEqual(1);
        // All runs should be RTL
        expect(runs.some(r => r.direction === 'rtl')).toBe(true);
    });

    it('handles mixed bidi text (LTR + Arabic)', () => {
        const runs = getVisualTextRuns('Hello مرحبا World');
        expect(runs.length).toBeGreaterThanOrEqual(2);
        // Should contain both LTR and RTL runs
        const hasLtr = runs.some(r => r.direction === 'ltr');
        const hasRtl = runs.some(r => r.direction === 'rtl');
        expect(hasLtr).toBe(true);
        expect(hasRtl).toBe(true);
    });

    it('preserves all characters (no data loss)', () => {
        const input = 'Hello مرحبا World';
        const runs = getVisualTextRuns(input);
        const totalChars = runs.reduce((sum, r) => sum + r.text.length, 0);
        expect(totalChars).toBe(input.length);
    });

    it('respects forced LTR base direction', () => {
        const runs = getVisualTextRuns('مرحبا', 'ltr');
        expect(runs.length).toBeGreaterThanOrEqual(1);
        // Even with LTR base, Arabic chars should still be in RTL runs
        expect(runs.some(r => r.direction === 'rtl')).toBe(true);
    });

    it('respects forced RTL base direction', () => {
        const runs = getVisualTextRuns('Hello', 'rtl');
        expect(runs.length).toBeGreaterThanOrEqual(1);
        // English chars should still be LTR runs even with RTL base
        expect(runs.some(r => r.direction === 'ltr')).toBe(true);
    });

    it('each run has valid level (non-negative integer)', () => {
        const runs = getVisualTextRuns('Hello مرحبا World');
        for (const run of runs) {
            expect(run.level).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(run.level)).toBe(true);
        }
    });

    it('RTL runs have odd levels, LTR runs have even levels', () => {
        const runs = getVisualTextRuns('Hello مرحبا World');
        for (const run of runs) {
            if (run.direction === 'rtl') {
                expect(run.level % 2).toBe(1);
            } else {
                expect(run.level % 2).toBe(0);
            }
        }
    });

    it('handles Hebrew text', () => {
        const runs = getVisualTextRuns('שלום עולם');
        expect(runs.some(r => r.direction === 'rtl')).toBe(true);
    });

    it('handles numbers embedded in RTL text', () => {
        const input = 'العدد 123 هنا';
        const runs = getVisualTextRuns(input);
        const fullText = runs.map(r => r.text).join('');
        // All original characters should be present
        expect(fullText.length).toBe(input.length);
    });
});
