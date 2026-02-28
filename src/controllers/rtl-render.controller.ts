import {
    Disposable,
    Inject,
    LifecycleService,
    LifecycleStages,
    TextDirection,
    UniverInstanceType,
} from '@univerjs/core';
import { IRenderManagerService, Spreadsheet } from '@univerjs/engine-render';
import { getFirstStrongDirection } from '../utils/rtl-detector';

/**
 * Offset used by Univer to prevent 1px anti-aliasing blur on canvas.
 * Matches the constant in @univerjs/engine-render.
 */
const FIX_ONE_PIXEL_BLUR_OFFSET = 0.5;

/**
 * RtlRenderController monkey-patches the Font extension's renderFontEachCell
 * to support per-cell RTL text rendering in spreadsheets.
 *
 * Strategy:
 *   Univer's default rendering pipeline breaks RTL text because it renders
 *   each character (glyph) individually with pre-computed LTR positions.
 *   This causes two problems:
 *     1. Character order is reversed (LTR layout applied to RTL text).
 *     2. Arabic connected forms are broken (isolated forms instead of joined).
 *
 *   Root cause: SpreadsheetSkeleton._getDocumentDataByStyle() doesn't pass
 *   textDirection to DocumentDataModel.paragraphStyle, and the layout engine
 *   has `direction` commented out in its line operator.
 *
 *   Our fix: For RTL cells, bypass Univer's per-glyph rendering entirely.
 *   Instead, render the full cell text with a single Canvas fillText() call
 *   with ctx.direction='rtl'. The browser's native text shaping engine then
 *   handles character ordering, Arabic joining, and bidirectional layout.
 *
 *   Limitations:
 *     - Rich text cells (cell.p) fall back to original renderer.
 *     - Text wrapping falls back to original renderer.
 *     - Rotated text falls back to original renderer.
 *     - Font metrics may differ slightly from Univer's computed layout.
 */
export class RtlRenderController extends Disposable {
    /** Tracks restore functions for all patched spreadsheet render units. */
    private readonly _restoreFns: Array<() => void> = [];

    constructor(
        @Inject(LifecycleService) private readonly _lifecycleService: LifecycleService,
        @Inject(IRenderManagerService) private readonly _renderManagerService: IRenderManagerService
    ) {
        super();
        this.disposeWithMe(
            this._lifecycleService.lifecycle$.subscribe((stage) => {
                if (stage === LifecycleStages.Rendered) {
                    this._patchAllSheetRenderers();
                    this._watchNewRenderers();
                }
            })
        );
    }

    override dispose(): void {
        for (const restore of this._restoreFns) {
            restore();
        }
        this._restoreFns.length = 0;
        super.dispose();
    }

    // -------------------------------------------------------------------------
    // Patching helpers
    // -------------------------------------------------------------------------

    private _patchAllSheetRenderers(): void {
        const renderers = this._renderManagerService.getAllRenderersOfType(UniverInstanceType.UNIVER_SHEET);
        for (const renderer of renderers) {
            this._patchRenderer(renderer.unitId);
        }
    }

    private _watchNewRenderers(): void {
        this.disposeWithMe(
            this._renderManagerService.created$.subscribe((render) => {
                if (render.type === UniverInstanceType.UNIVER_SHEET) {
                    this._patchRenderer(render.unitId);
                }
            })
        );
    }

    /**
     * Monkey-patches the Font extension's renderFontEachCell for one render unit.
     */
    private _patchRenderer(unitId: string): void {
        const render = this._renderManagerService.getRenderById(unitId);
        if (!render) return;

        const spreadsheet = render.mainComponent as Spreadsheet | null;
        if (!spreadsheet || typeof (spreadsheet as any).fontExtension === 'undefined') return;

        const fontExt = spreadsheet.fontExtension;
        if (!fontExt || typeof fontExt.renderFontEachCell !== 'function') return;

        const originalRenderFontEachCell = fontExt.renderFontEachCell.bind(fontExt);

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        fontExt.renderFontEachCell = function patchedRenderFontEachCell(
            renderFontCtx: any,
            row: number,
            col: number,
            fontMatrix: any
        ): true | undefined {
            // Non-RTL cells: use original per-glyph rendering.
            if (!self._isCellRtl(renderFontCtx, row, col)) {
                return originalRenderFontEachCell(renderFontCtx, row, col, fontMatrix);
            }

            // Get cell data — rich text (cell.p) falls back to original.
            const { ctx, spreadsheetSkeleton, cellInfo } = renderFontCtx;
            const cellData = spreadsheetSkeleton.worksheet.getCell(row, col);
            if (!cellData || cellData.p) {
                return originalRenderFontEachCell(renderFontCtx, row, col, fontMatrix);
            }

            const cellText = cellData.v != null ? String(cellData.v) : '';
            if (!cellText) {
                return originalRenderFontEachCell(renderFontCtx, row, col, fontMatrix);
            }

            // --- Replicate standard checks from original renderFontEachCell ---
            const { startY, endY, startX, endX, isMerged, isMergedMainCell, mergeInfo } = cellInfo;
            renderFontCtx.startX = startX;
            renderFontCtx.startY = startY;
            renderFontCtx.endX = endX;
            renderFontCtx.endY = endY;

            if (isMerged && !isMergedMainCell) return true;
            if (isMergedMainCell) {
                renderFontCtx.startX = mergeInfo.startX;
                renderFontCtx.startY = mergeInfo.startY;
                renderFontCtx.endX = mergeInfo.endX;
                renderFontCtx.endY = mergeInfo.endY;
            }

            const fontsConfig = fontMatrix.getValue(row, col);
            if (!fontsConfig) return true;

            // Rotated text or wrapped text: fall back to original renderer
            // (WrapStrategy.WRAP = 3 in Univer)
            const vertexAngle = fontsConfig.vertexAngle || 0;
            const wrapStrategy = fontsConfig.wrapStrategy || 0;
            if (vertexAngle !== 0 || wrapStrategy === 3) {
                return originalRenderFontEachCell(renderFontCtx, row, col, fontMatrix);
            }

            // Visibility checks
            if (!spreadsheetSkeleton.worksheet.getRowVisible(row) ||
                !spreadsheetSkeleton.worksheet.getColVisible(col)) return true;
            if (cellData.fontRenderExtension?.isSkip) return true;

            // --- Custom RTL rendering ---
            const overflowRange = spreadsheetSkeleton.overflowCache.getValue(row, col);

            ctx.save();
            ctx.beginPath();

            renderFontCtx.overflowRectangle = overflowRange;
            renderFontCtx.cellData = cellData;

            // Use the Font extension's _setFontRenderBounds for proper overflow clipping.
            try {
                (fontExt as any)._setFontRenderBounds(renderFontCtx, row, col, fontMatrix);
            } catch {
                // Fallback: simple cell clip
                const scale = renderFontCtx.scale || 1;
                const cw = renderFontCtx.endX - renderFontCtx.startX;
                const ch = renderFontCtx.endY - renderFontCtx.startY;
                ctx.rectByPrecision
                    ? ctx.rectByPrecision(
                          renderFontCtx.startX + 1 / scale,
                          renderFontCtx.startY + 1 / scale,
                          cw - 2 / scale,
                          ch - 2 / scale
                      )
                    : ctx.rect(renderFontCtx.startX, renderFontCtx.startY, cw, ch);
                ctx.clip();
            }

            // Translate to cell origin (same as original renderer).
            ctx.translate(
                renderFontCtx.startX + FIX_ONE_PIXEL_BLUR_OFFSET,
                renderFontCtx.startY + FIX_ONE_PIXEL_BLUR_OFFSET
            );

            const cellWidth = renderFontCtx.endX - renderFontCtx.startX;
            const cellHeight = renderFontCtx.endY - renderFontCtx.startY;

            // Resolve cell style for font/color.
            const style = (spreadsheetSkeleton as any)._styles?.getStyleByCell(cellData);

            self._renderRtlDirect(ctx, cellText, cellWidth, cellHeight, style, fontsConfig.verticalAlign || 0);

            ctx.closePath();
            ctx.restore();

            return undefined;
        };

        const restore = (): void => {
            fontExt.renderFontEachCell = originalRenderFontEachCell;
        };

        this._restoreFns.push(restore);

        this.disposeWithMe(
            this._renderManagerService.disposed$.subscribe((disposedUnitId) => {
                if (disposedUnitId === unitId) {
                    restore();
                }
            })
        );
    }

    // -------------------------------------------------------------------------
    // RTL direct Canvas rendering
    // -------------------------------------------------------------------------

    /**
     * Renders cell text directly on the Canvas with native RTL support.
     *
     * This bypasses Univer's per-glyph rendering to get correct:
     *   - Arabic/Hebrew character ordering (right-to-left)
     *   - Arabic connected forms (initial/medial/final joining)
     *   - Bidirectional text layout (mixed LTR+RTL segments)
     */
    private _renderRtlDirect(
        ctx: any,
        text: string,
        cellWidth: number,
        cellHeight: number,
        style: any,
        verticalAlign: number
    ): void {
        // Access the native Canvas2D context for properties that
        // UniverRenderingContext2D may not directly expose.
        const nativeCtx: CanvasRenderingContext2D =
            (ctx as any)._context || ctx;

        // --- Font ---
        const fontSize = style?.fs || 11;
        const fontFamily = style?.ff || 'Arial';
        // Univer stores font size in points; Canvas needs pixels (1pt ≈ 1.333px at 96 DPI).
        const fontSizePx = Math.round(fontSize * (4 / 3));
        const italic = style?.it === 1 ? 'italic ' : '';
        const bold = style?.bl === 1 ? 'bold ' : '';
        nativeCtx.font = `${italic}${bold}${fontSizePx}px ${fontFamily}`;

        // --- Text color ---
        const rawColor = style?.cl;
        const textColor =
            rawColor && typeof rawColor === 'object'
                ? rawColor.rgb
                : rawColor;
        nativeCtx.fillStyle = textColor || '#000000';

        // --- Direction & alignment ---
        nativeCtx.direction = 'rtl';
        nativeCtx.textAlign = 'right';

        // --- Padding ---
        const pd = style?.pd || {};
        const paddingTop = pd.t || 0;
        const paddingBottom = pd.b || 0;
        const paddingRight = pd.r || 2;

        // --- Vertical position ---
        // VerticalAlign enum: UNSPECIFIED=0, TOP=1, MIDDLE=2, BOTTOM=3
        let y: number;
        switch (verticalAlign) {
            case 1: // TOP
                nativeCtx.textBaseline = 'top';
                y = paddingTop;
                break;
            case 2: // MIDDLE
                nativeCtx.textBaseline = 'middle';
                y = cellHeight / 2;
                break;
            default: // BOTTOM (3) or UNSPECIFIED (0) — spreadsheets default to bottom
                nativeCtx.textBaseline = 'bottom';
                y = cellHeight - paddingBottom - 2;
                break;
        }

        // Single fillText call — browser handles RTL character ordering,
        // Arabic shaping (joining), and bidirectional layout natively.
        nativeCtx.fillText(text, cellWidth - paddingRight, y);
    }

    // -------------------------------------------------------------------------
    // RTL detection
    // -------------------------------------------------------------------------

    /**
     * Determines whether a cell should be rendered in RTL mode.
     *
     * Priority:
     *   1. Explicit IStyleData.td === TextDirection.RIGHT_TO_LEFT (user-set).
     *   2. Explicit IStyleData.td === TextDirection.LEFT_TO_RIGHT (user-set LTR, skip auto-detect).
     *   3. Auto-detection: first strong directional character is RTL (Excel "Context" mode).
     *   4. Default: LTR (return false).
     */
    private _isCellRtl(renderFontCtx: any, row: number, col: number): boolean {
        const skeleton = renderFontCtx?.spreadsheetSkeleton;

        if (skeleton) {
            try {
                const worksheet = skeleton.worksheet;
                const cell = worksheet?.getCell(row, col);
                if (cell) {
                    const styles = (skeleton as any)._styles;
                    const style = styles?.getStyleByCell(cell);
                    if (style?.td === TextDirection.RIGHT_TO_LEFT) return true;
                    if (style?.td === TextDirection.LEFT_TO_RIGHT) return false;
                }

                // Fall back to first-strong-character auto-detection
                // (matches Excel's "Context" / readingOrder=0 behavior).
                const cellRaw = worksheet?.getCellRaw?.(row, col);
                const text = cellRaw?.v != null ? String(cellRaw.v) : '';
                if (text && getFirstStrongDirection(text) === 'rtl') return true;
            } catch {
                // If skeleton introspection fails, default to LTR.
            }
        }

        return false;
    }
}
