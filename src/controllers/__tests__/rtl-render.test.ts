import { describe, it, expect, vi } from 'vitest';

// Mock @univerjs/core to avoid decorator runtime failures in test environment.
// OnLifecycle and Inject are TypeScript decorators that rely on the Univer DI
// runtime, which is not available in unit tests.
vi.mock('@univerjs/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@univerjs/core')>();
    return {
        ...actual,
        OnLifecycle: () => () => {},   // no-op class decorator
        Inject: () => () => {},         // no-op parameter decorator
    };
});

// Mock @univerjs/engine-render since it's not installed as a dev dependency.
vi.mock('@univerjs/engine-render', () => ({
    IRenderManagerService: 'IRenderManagerService',
    Spreadsheet: class Spreadsheet {},
}));

// Import after mock is set up
import { TextDirection } from '@univerjs/core';
import { isRTLDominant } from '../../utils/rtl-detector';

/**
 * Tests for RtlRenderController.
 *
 * The controller relies on Univer DI (IRenderManagerService, IUniverInstanceService)
 * which cannot be fully mocked in unit tests. We focus on:
 *  1. The cell RTL detection logic (tested through the pure utility functions
 *     that _isCellRtl delegates to).
 *  2. The monkey-patch mechanics using a plain object mock of the font extension.
 */

// ---------------------------------------------------------------------------
// Tests: _isCellRtl logic (tested through the underlying pure functions)
//
// The controller's _isCellRtl() uses:
//   1. Cell style td === TextDirection.RIGHT_TO_LEFT → force RTL
//   2. Cell style td === TextDirection.LEFT_TO_RIGHT → force LTR
//   3. No td set → delegate to isRTLDominant(text)
// We test this logic directly via the imported pure functions.
// ---------------------------------------------------------------------------

describe('Cell RTL detection logic (underlying pure functions)', () => {
    describe('TextDirection enum values', () => {
        it('TextDirection.RIGHT_TO_LEFT is defined', () => {
            expect(TextDirection.RIGHT_TO_LEFT).toBeDefined();
        });

        it('TextDirection.LEFT_TO_RIGHT is defined', () => {
            expect(TextDirection.LEFT_TO_RIGHT).toBeDefined();
        });

        it('RIGHT_TO_LEFT and LEFT_TO_RIGHT are distinct values', () => {
            expect(TextDirection.RIGHT_TO_LEFT).not.toBe(TextDirection.LEFT_TO_RIGHT);
        });
    });

    describe('auto-detection via isRTLDominant (fallback when no td set)', () => {
        it('returns true for Arabic cell content', () => {
            expect(isRTLDominant('مرحبا بالعالم')).toBe(true);
        });

        it('returns true for Hebrew cell content', () => {
            expect(isRTLDominant('שלום עולם')).toBe(true);
        });

        it('returns false for English cell content', () => {
            expect(isRTLDominant('Hello World')).toBe(false);
        });

        it('returns false for empty content', () => {
            expect(isRTLDominant('')).toBe(false);
        });

        it('returns false for numeric content', () => {
            expect(isRTLDominant('12345')).toBe(false);
        });

        it('uses 0.3 default threshold for mixed content', () => {
            // isRTLDominant uses 0.3 threshold by default
            // Majority Arabic should exceed threshold
            expect(isRTLDominant('مرحبا Hello World')).toBe(true);
            // Tiny RTL content should fall below threshold
            expect(isRTLDominant('Hello World with one م')).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: monkey-patch mechanics via plain object mocks
// (Tests the patching pattern without instantiating the full controller)
// ---------------------------------------------------------------------------

describe('Monkey-patch mechanics', () => {
    /**
     * Simulates what RtlRenderController._patchRenderer does:
     * wraps renderFontEachCell to set RTL context for RTL cells.
     */
    function applyRtlPatch(fontExt: { renderFontEachCell: (...args: any[]) => any }) {
        const originalRef = fontExt.renderFontEachCell;
        const original = originalRef.bind(fontExt);
        const restoreFns: Array<() => void> = [];

        fontExt.renderFontEachCell = function patchedRenderFontEachCell(
            renderFontCtx: any,
            row: number,
            col: number,
            fontMatrix: any
        ) {
            // Replicate _isCellRtl logic inline
            const cellData = renderFontCtx?.cellData;
            let isRtl = false;
            if (cellData?.s && typeof cellData.s === 'object') {
                const td = cellData.s.td;
                if (td === TextDirection.RIGHT_TO_LEFT) isRtl = true;
                else if (td === TextDirection.LEFT_TO_RIGHT) isRtl = false;
            } else {
                const text = renderFontCtx?.text ?? '';
                isRtl = isRTLDominant(text);
            }

            if (!isRtl) {
                return original(renderFontCtx, row, col, fontMatrix);
            }

            const ctx = renderFontCtx.ctx;
            ctx.save();
            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            try {
                return original(renderFontCtx, row, col, fontMatrix);
            } finally {
                ctx.restore();
            }
        };

        const restore = () => { fontExt.renderFontEachCell = originalRef; };
        restoreFns.push(restore);
        return { restore, restoreFns };
    }

    function makeMockCtx() {
        return {
            save: vi.fn(),
            restore: vi.fn(),
            direction: 'ltr' as string,
            textAlign: 'left' as string,
        };
    }

    it('replaces renderFontEachCell with a wrapped version', () => {
        const originalFn = vi.fn().mockReturnValue(true);
        const fontExt = { renderFontEachCell: originalFn };
        applyRtlPatch(fontExt);
        expect(fontExt.renderFontEachCell).not.toBe(originalFn);
        expect(typeof fontExt.renderFontEachCell).toBe('function');
    });

    it('calls original for LTR cells (no RTL ctx changes)', () => {
        const originalFn = vi.fn().mockReturnValue(true);
        const fontExt = { renderFontEachCell: originalFn };
        applyRtlPatch(fontExt);

        const ctx = makeMockCtx();
        fontExt.renderFontEachCell({ ctx, cellData: { s: { td: TextDirection.LEFT_TO_RIGHT } }, text: '' }, 0, 0, {});

        expect(ctx.save).not.toHaveBeenCalled();
        expect(originalFn).toHaveBeenCalledOnce();
    });

    it('sets ctx.direction="rtl" for cells with TextDirection.RIGHT_TO_LEFT', () => {
        const originalFn = vi.fn().mockReturnValue(true);
        const fontExt = { renderFontEachCell: originalFn };
        applyRtlPatch(fontExt);

        const ctx = makeMockCtx();
        fontExt.renderFontEachCell({ ctx, cellData: { s: { td: TextDirection.RIGHT_TO_LEFT } }, text: '' }, 0, 0, {});

        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.direction).toBe('rtl');
        expect(ctx.textAlign).toBe('right');
        expect(ctx.restore).toHaveBeenCalled();
        expect(originalFn).toHaveBeenCalledOnce();
    });

    it('auto-detects RTL from Arabic text content', () => {
        const originalFn = vi.fn().mockReturnValue(true);
        const fontExt = { renderFontEachCell: originalFn };
        applyRtlPatch(fontExt);

        const ctx = makeMockCtx();
        fontExt.renderFontEachCell({ ctx, cellData: null, text: 'مرحبا بالعالم' }, 0, 0, {});

        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.direction).toBe('rtl');
        expect(ctx.restore).toHaveBeenCalled();
    });

    it('does not set RTL for English text content', () => {
        const originalFn = vi.fn().mockReturnValue(true);
        const fontExt = { renderFontEachCell: originalFn };
        applyRtlPatch(fontExt);

        const ctx = makeMockCtx();
        fontExt.renderFontEachCell({ ctx, cellData: null, text: 'Hello World' }, 0, 0, {});

        expect(ctx.save).not.toHaveBeenCalled();
        expect(originalFn).toHaveBeenCalledOnce();
    });

    it('restores ctx.restore() even if original function throws', () => {
        const originalFn = vi.fn().mockImplementation(() => { throw new Error('render error'); });
        const fontExt = { renderFontEachCell: originalFn };
        applyRtlPatch(fontExt);

        const ctx = makeMockCtx();
        expect(() =>
            fontExt.renderFontEachCell({ ctx, cellData: { s: { td: TextDirection.RIGHT_TO_LEFT } }, text: '' }, 0, 0, {})
        ).toThrow('render error');

        expect(ctx.restore).toHaveBeenCalled();
    });

    it('restore() reverts renderFontEachCell to original', () => {
        const originalFn = vi.fn().mockReturnValue(true);
        const fontExt = { renderFontEachCell: originalFn };
        const { restore } = applyRtlPatch(fontExt);

        expect(fontExt.renderFontEachCell).not.toBe(originalFn);
        restore();
        expect(fontExt.renderFontEachCell).toBe(originalFn);
    });

    it('multiple restore() calls are idempotent', () => {
        const originalFn = vi.fn().mockReturnValue(true);
        const fontExt = { renderFontEachCell: originalFn };
        const { restore } = applyRtlPatch(fontExt);

        expect(() => {
            restore();
            restore();
        }).not.toThrow();
        expect(fontExt.renderFontEachCell).toBe(originalFn);
    });
});
