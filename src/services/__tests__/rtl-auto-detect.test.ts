import { describe, it, expect, beforeEach } from 'vitest';
import { RtlAutoDetectService } from '../rtl-auto-detect.service';

describe('RtlAutoDetectService', () => {
    let service: RtlAutoDetectService;

    beforeEach(() => {
        service = new RtlAutoDetectService();
    });

    describe('shouldBeRTL()', () => {
        it('returns false for empty/null input', () => {
            expect(service.shouldBeRTL('')).toBe(false);
            expect(service.shouldBeRTL(null as any)).toBe(false);
            expect(service.shouldBeRTL(undefined as any)).toBe(false);
        });

        it('returns true for pure Arabic text', () => {
            expect(service.shouldBeRTL('مرحبا بالعالم')).toBe(true);
        });

        it('returns true for pure Hebrew text', () => {
            expect(service.shouldBeRTL('שלום עולם')).toBe(true);
        });

        it('returns false for pure English text', () => {
            expect(service.shouldBeRTL('Hello World')).toBe(false);
        });

        it('returns false for mixed text below default threshold (0.5)', () => {
            // Small RTL portion among large LTR text - should be below 0.5 threshold
            expect(service.shouldBeRTL('Hello World with Arabic م')).toBe(false);
        });

        it('returns true for mixed text above default threshold (0.5)', () => {
            // More Arabic chars than Latin: 10 Arabic, 5 Latin → ratio ~0.67 > 0.5
            expect(service.shouldBeRTL('مرحبا بالعالم Hello')).toBe(true);
        });

        describe('threshold configuration', () => {
            it('returns true with low threshold (0.3) for partially RTL text', () => {
                service.threshold = 0.3;
                // ~40% RTL content should pass threshold of 0.3
                expect(service.shouldBeRTL('مرحبا Hello World')).toBe(true);
            });

            it('returns false with high threshold (0.9) for partially RTL text', () => {
                service.threshold = 0.9;
                // Mixed text won't reach 0.9 RTL ratio
                expect(service.shouldBeRTL('مرحبا Hello World')).toBe(false);
            });

            it('returns true with high threshold (0.9) for pure RTL text', () => {
                service.threshold = 0.9;
                expect(service.shouldBeRTL('مرحبا بالعالم')).toBe(true);
            });

            it('threshold setter clears cache', () => {
                // Populate cache
                service.shouldBeRTL('مرحبا Hello');
                // Change threshold - cache should be cleared
                service.threshold = 0.9;
                // Result should be re-evaluated with new threshold
                expect(service.shouldBeRTL('مرحبا Hello')).toBe(false);
            });

            it('threshold setter no-op when same value (does not clear cache unnecessarily)', () => {
                const currentThreshold = service.threshold;
                // Use text that clearly passes the 0.5 threshold
                service.shouldBeRTL('مرحبا بالعالم');
                // Setting same value should not clear cache
                service.threshold = currentThreshold;
                // The cached result should still be valid
                expect(service.shouldBeRTL('مرحبا بالعالم')).toBe(true);
            });
        });

        describe('cache behavior', () => {
            it('returns same result on cache hit', () => {
                const text = 'مرحبا بالعالم';
                const firstResult = service.shouldBeRTL(text);
                const secondResult = service.shouldBeRTL(text);
                expect(firstResult).toBe(secondResult);
            });

            it('caches results for different texts independently', () => {
                const arabic = 'مرحبا';
                const english = 'Hello';
                expect(service.shouldBeRTL(arabic)).toBe(true);
                expect(service.shouldBeRTL(english)).toBe(false);
                // Call again to verify cache hits return correct values
                expect(service.shouldBeRTL(arabic)).toBe(true);
                expect(service.shouldBeRTL(english)).toBe(false);
            });
        });
    });

    describe('enable/disable toggle', () => {
        it('is enabled by default', () => {
            expect(service.enabled).toBe(true);
        });

        it('setEnabled(false) disables detection', () => {
            service.setEnabled(false);
            expect(service.enabled).toBe(false);
        });

        it('setEnabled(true) re-enables detection', () => {
            service.setEnabled(false);
            service.setEnabled(true);
            expect(service.enabled).toBe(true);
        });

        it('shouldBeRTL() returns false when disabled regardless of content', () => {
            service.setEnabled(false);
            expect(service.shouldBeRTL('مرحبا بالعالم')).toBe(false);
            expect(service.shouldBeRTL('שלום עולם')).toBe(false);
        });

        it('shouldBeRTL() works correctly after re-enabling', () => {
            service.setEnabled(false);
            expect(service.shouldBeRTL('مرحبا بالعالم')).toBe(false);
            service.setEnabled(true);
            expect(service.shouldBeRTL('مرحبا بالعالم')).toBe(true);
        });
    });

    describe('clearCache()', () => {
        it('clears cached results', () => {
            // Populate cache
            service.shouldBeRTL('مرحبا');
            service.clearCache();
            // After clear, result should be re-computed (same result but from fresh computation)
            expect(service.shouldBeRTL('مرحبا')).toBe(true);
        });

        it('can be called multiple times without error', () => {
            expect(() => {
                service.clearCache();
                service.clearCache();
            }).not.toThrow();
        });

        it('works when cache is empty', () => {
            expect(() => service.clearCache()).not.toThrow();
        });
    });

    describe('getDirection()', () => {
        it('returns "auto" for empty/blank input', () => {
            expect(service.getDirection('')).toBe('auto');
            expect(service.getDirection('   ')).toBe('auto');
        });

        it('returns "ltr" for pure English text', () => {
            expect(service.getDirection('Hello World')).toBe('ltr');
        });

        it('returns "rtl" for predominantly Arabic text', () => {
            expect(service.getDirection('مرحبا بالعالم')).toBe('rtl');
        });

        it('returns "rtl" for predominantly Hebrew text', () => {
            expect(service.getDirection('שלום עולם')).toBe('rtl');
        });

        it('returns "auto" for mixed text below threshold but with RTL chars', () => {
            // Very small RTL portion - has RTL chars but below threshold
            expect(service.getDirection('Hello World with Arabic م')).toBe('auto');
        });

        it('returns "ltr" when disabled regardless of content', () => {
            service.setEnabled(false);
            expect(service.getDirection('مرحبا بالعالم')).toBe('ltr');
        });

        it('returns valid direction values', () => {
            const validDirections = ['ltr', 'rtl', 'auto'];
            expect(validDirections).toContain(service.getDirection('Hello'));
            expect(validDirections).toContain(service.getDirection('مرحبا'));
            expect(validDirections).toContain(service.getDirection('Hello م World'));
        });
    });

    describe('threshold property', () => {
        it('has default threshold of 0.5', () => {
            expect(service.threshold).toBe(0.5);
        });

        it('can be set to custom value', () => {
            service.threshold = 0.3;
            expect(service.threshold).toBe(0.3);
        });

        it('can be set to 0.9', () => {
            service.threshold = 0.9;
            expect(service.threshold).toBe(0.9);
        });
    });
});
