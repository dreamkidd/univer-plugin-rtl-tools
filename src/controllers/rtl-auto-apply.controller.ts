import {
    Disposable,
    HorizontalAlign,
    ICommandService,
    Inject,
    IUniverInstanceService,
    LifecycleService,
    LifecycleStages,
    TextDirection,
    UniverInstanceType,
} from '@univerjs/core';
import type { Workbook, Worksheet } from '@univerjs/core';
import { isRTLDominant } from '../utils/rtl-detector';

/**
 * Unicode RIGHT-TO-LEFT MARK — zero-width char that establishes RTL base
 * direction for the BiDi algorithm. Ensures mixed text (Arabic + numbers)
 * renders correctly: numbers on the left side.
 */
const RLM = '\u200F';

/**
 * RtlAutoApplyController scans all cells on workbook load and automatically
 * sets td (TextDirection.RIGHT_TO_LEFT) + ht (HorizontalAlign.RIGHT) for
 * cells containing RTL-dominant text. Also prepends RLM for correct BiDi
 * reordering of mixed text.
 *
 * This runs once after the workbook is rendered, and also watches for
 * cell value changes to apply RTL detection on new input.
 */
export class RtlAutoApplyController extends Disposable {
    constructor(
        @Inject(LifecycleService) private readonly _lifecycleService: LifecycleService,
        @Inject(IUniverInstanceService) private readonly _univerInstanceService: IUniverInstanceService,
        @Inject(ICommandService) private readonly _commandService: ICommandService
    ) {
        super();

        this.disposeWithMe(
            this._lifecycleService.lifecycle$.subscribe((stage) => {
                if (stage === LifecycleStages.Rendered) {
                    this._scanAndApplyAll();
                    this._watchCellEdits();
                }
            })
        );
    }

    /**
     * Scan all cells in all sheets and apply RTL styles where needed.
     */
    private _scanAndApplyAll(): void {
        const workbook = this._univerInstanceService.getCurrentUnitForType<Workbook>(
            UniverInstanceType.UNIVER_SHEET
        );
        if (!workbook) return;

        const sheets = workbook.getSheets();
        for (const sheet of sheets) {
            this._scanSheet(sheet);
        }
    }

    /**
     * Scan a single sheet and batch-apply RTL styles.
     */
    private _scanSheet(sheet: Worksheet): void {
        const maxRow = sheet.getRowCount();
        const maxCol = sheet.getColumnCount();
        const cellMatrix = sheet.getCellMatrix();

        // Collect cells that need RTL style
        const rtlCells: Array<{ row: number; col: number }> = [];

        for (let row = 0; row < Math.min(maxRow, 10000); row++) {
            for (let col = 0; col < Math.min(maxCol, 100); col++) {
                const cell = cellMatrix.getValue(row, col);
                if (!cell) continue;

                // Skip if td is already set explicitly
                const style = typeof cell.s === 'object' ? cell.s : null;
                if (style && (style as any).td != null) continue;

                const text = cell.v != null ? String(cell.v) : '';
                if (!text || !isRTLDominant(text, 0.3)) continue;

                rtlCells.push({ row, col });

                // Prepend RLM for BiDi reordering if not already present
                if (typeof cell.v === 'string' && !cell.v.startsWith(RLM)) {
                    cell.v = RLM + cell.v;
                }
            }
        }

        if (rtlCells.length === 0) return;

        // Batch-apply td + ht via set-range-values command for each RTL cell.
        // Group into a single mutation to minimize overhead.
        const sheetId = sheet.getSheetId();
        const unitId = sheet.getUnitId();

        for (const { row, col } of rtlCells) {
            try {
                this._commandService.syncExecuteCommand('sheet.command.set-range-values', {
                    unitId,
                    subUnitId: sheetId,
                    range: { startRow: row, endRow: row, startColumn: col, endColumn: col },
                    value: {
                        s: {
                            td: TextDirection.RIGHT_TO_LEFT,
                            ht: HorizontalAlign.RIGHT,
                        },
                    },
                });
            } catch {
                // Silently skip if command fails for a cell
            }
        }

        console.log(
            `[RtlToolsPlugin] Auto-applied RTL to ${rtlCells.length} cells in sheet "${sheet.getName()}"`
        );
    }

    /**
     * Watch for cell value changes and apply RTL detection on new input.
     */
    private _watchCellEdits(): void {
        this.disposeWithMe(
            this._commandService.onCommandExecuted((commandInfo) => {
                // Listen for cell value changes (SetRangeValues, editor confirm, etc.)
                if (commandInfo.id !== 'sheet.command.set-range-values') return;

                const params = commandInfo.params as any;
                if (!params?.value) return;

                // Check if the new value contains RTL text
                const cellValue = params.value;
                const text = cellValue?.v != null ? String(cellValue.v) : '';
                if (!text || !isRTLDominant(text, 0.3)) return;

                // The cell was just set — apply RTL style if not already set
                const existingStyle = cellValue?.s;
                if (existingStyle && typeof existingStyle === 'object' && (existingStyle as any).td != null) {
                    return; // Already has td set
                }

                // Apply RTL style on next tick to avoid re-entrant command execution
                setTimeout(() => {
                    try {
                        this._commandService.syncExecuteCommand('sheet.command.set-range-values', {
                            unitId: params.unitId,
                            subUnitId: params.subUnitId,
                            range: params.range,
                            value: {
                                s: {
                                    td: TextDirection.RIGHT_TO_LEFT,
                                    ht: HorizontalAlign.RIGHT,
                                },
                            },
                        });
                    } catch {
                        // ignore
                    }
                }, 0);
            })
        );
    }
}
