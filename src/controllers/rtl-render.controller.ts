import {
    Disposable,
    Inject,
    LifecycleService,
    LifecycleStages,
    TextDirection,
    UniverInstanceType,
} from '@univerjs/core';
import { IRenderManagerService, Spreadsheet } from '@univerjs/engine-render';
import { getVisualTextRuns } from '../utils/bidi-processor';
import { isRTLDominant } from '../utils/rtl-detector';

/**
 * RtlRenderController monkey-patches the Font extension's renderFontEachCell
 * to support per-cell RTL text rendering in spreadsheets.
 *
 * Strategy:
 *   1. Obtain the Spreadsheet instance via IRenderManagerService.
 *   2. Access spreadsheet.fontExtension (public getter).
 *   3. Wrap renderFontEachCell to:
 *      - Detect if the cell has td === TextDirection.RIGHT_TO_LEFT or dominant RTL content.
 *      - For RTL cells: set ctx.direction='rtl' and ctx.textAlign='right'.
 *      - Call the original method (which invokes Documents.draw → FontAndBaseLine).
 *      - Restore the context afterwards.
 *   4. On dispose, restore the original method.
 */
export class RtlRenderController extends Disposable {
    /** Tracks restore functions for all patched spreadsheet render units. */
    private readonly _restoreFns: Array<() => void> = [];

    constructor(
        @Inject(LifecycleService) private readonly _lifecycleService: LifecycleService,
        @Inject(IRenderManagerService) private readonly _renderManagerService: IRenderManagerService
    ) {
        super();
        // Defer patching until the Rendered lifecycle stage so that the
        // spreadsheet render units are fully initialized before we access them.
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

    /**
     * Patches all currently registered sheet render units.
     * Called once at startup (Rendered lifecycle).
     */
    private _patchAllSheetRenderers(): void {
        const renderers = this._renderManagerService.getAllRenderersOfType(UniverInstanceType.UNIVER_SHEET);
        for (const renderer of renderers) {
            this._patchRenderer(renderer.unitId);
        }
    }

    /**
     * Watches for new render units being created after startup
     * (e.g. when a second workbook is opened).
     */
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
            const isRtlCell = self._isCellRtl(renderFontCtx, row, col);

            if (!isRtlCell) {
                return originalRenderFontEachCell(renderFontCtx, row, col, fontMatrix);
            }

            // Apply RTL context for this cell's render pass.
            const ctx = renderFontCtx.ctx;
            ctx.save();
            ctx.direction = 'rtl';
            ctx.textAlign = 'right';

            try {
                return originalRenderFontEachCell(renderFontCtx, row, col, fontMatrix);
            } finally {
                ctx.restore();
            }
        };

        const restore = (): void => {
            fontExt.renderFontEachCell = originalRenderFontEachCell;
        };

        this._restoreFns.push(restore);

        // Also restore when the render unit is disposed.
        this.disposeWithMe(
            this._renderManagerService.disposed$.subscribe((disposedUnitId) => {
                if (disposedUnitId === unitId) {
                    restore();
                }
            })
        );
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
     *   3. Auto-detection: cell content is RTL-dominant (>30% RTL chars).
     *   4. Default: LTR (return false).
     */
    private _isCellRtl(renderFontCtx: any, row: number, col: number): boolean {
        const skeleton = renderFontCtx?.spreadsheetSkeleton;

        // Use the skeleton's styles service to resolve style (handles both inline
        // object and string-ID references into the styles collection).
        if (skeleton) {
            try {
                const worksheet = skeleton.worksheet;
                const cell = worksheet?.getCell(row, col);
                if (cell) {
                    // _styles is the Styles instance on SpreadsheetSkeleton.
                    // getStyleByCell handles cell.s as string ID or inline object.
                    const styles = (skeleton as any)._styles;
                    const style = styles?.getStyleByCell(cell);
                    if (style?.td === TextDirection.RIGHT_TO_LEFT) return true;
                    if (style?.td === TextDirection.LEFT_TO_RIGHT) return false;
                }

                // Fall back to content-based auto-detection.
                const cellRaw = worksheet?.getCellRaw?.(row, col);
                const text = cellRaw?.v != null ? String(cellRaw.v) : '';
                if (text && isRTLDominant(text)) return true;
            } catch {
                // If skeleton introspection fails, default to LTR.
            }
        }

        return false;
    }
}

/**
 * Re-export getVisualTextRuns for convenience — callers (e.g. tests) may want
 * the bidi runs even without instantiating the controller.
 */
export { getVisualTextRuns };
