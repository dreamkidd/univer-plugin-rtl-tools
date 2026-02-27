# Font Extension Internals: Spreadsheet Rendering

**Research date:** 2026-02-27
**Source:** `node_modules/@univerjs/engine-render/lib/es/index.js`

---

## 1. Font Class Identity

```js
// lib/es/index.js:25928
const UNIQUE_KEY$6 = "DefaultFontExtension"
const FONT_EXTENSION_Z_INDEX = 45   // line 4922

class Font extends SheetExtension {
  uKey = "DefaultFontExtension"
  Z_INDEX = 45  // FONT_EXTENSION_Z_INDEX
}

// Auto-registered at module load:
SpreadsheetExtensionRegistry.add(Font);  // line 26071
```

---

## 2. renderFontEachCell — Exact Signature

### Type declaration (`lib/types/components/sheets/extensions/font.d.ts`):
```ts
renderFontEachCell(
  renderFontCtx: IRenderFontContext,
  row: number,
  col: number,
  fontMatrix: ObjectMatrix<IFontCacheItem>
): true | undefined
```

### IRenderFontContext shape (from type file):
```ts
interface IRenderFontContext {
  ctx: UniverRenderingContext;
  scale: number;
  rowHeightAccumulation: number[];
  columnTotalWidth: number;
  columnWidthAccumulation: number[];
  rowTotalHeight: number;
  viewRanges: IRange[];
  checkOutOfViewBound: boolean;
  diffRanges: IRange[];
  spreadsheetSkeleton: SpreadsheetSkeleton;
  overflowRectangle: Nullable<IRange>;
  cellData: ICellDataForSheetInterceptor;
  startY: number;
  endY: number;
  startX: number;
  endX: number;
  cellInfo: ISelectionCellWithMergeInfo;
}
```

### Compiled implementation (line 25973):
```js
renderFontEachCell(renderFontCtx, row, col, fontMatrix) {
  const { ctx, viewRanges, diffRanges, spreadsheetSkeleton, cellInfo } = renderFontCtx;
  const { startY, endY, startX, endX } = cellInfo;
  const { isMerged, isMergedMainCell, mergeInfo } = cellInfo;
  // ... sets renderFontCtx.startX/Y/endX/Y from cellInfo (or mergeInfo)

  const fontsConfig = fontMatrix.getValue(row, col);  // IFontCacheItem
  if (!fontsConfig) return true;

  const cellData = spreadsheetSkeleton.worksheet.getCell(row, col) || {};
  if (cellData.fontRenderExtension?.isSkip) return true;

  ctx.save();
  ctx.beginPath();
  renderFontCtx.overflowRectangle = overflowRange;
  renderFontCtx.cellData = cellData;
  this._setFontRenderBounds(renderFontCtx, row, col, fontMatrix);
  ctx.translate(renderFontCtx.startX + FIX_ONE_PIXEL_BLUR_OFFSET,
                renderFontCtx.startY + FIX_ONE_PIXEL_BLUR_OFFSET);
  this._renderDocuments(ctx, fontsConfig, ...);
  ctx.closePath();
  ctx.restore();
}
```

---

## 3. IFontCacheItem — Actual Fields

### From `lib/types/components/sheets/interfaces.d.ts` (line 14):
```ts
interface IFontCacheItem {
  documentSkeleton: DocumentSkeleton;  // Pre-calculated layout skeleton
  vertexAngle?: number;                // Rotation vertex angle (from textRotation)
  centerAngle?: number;                // Rotation center angle
  verticalAlign: VerticalAlign;        // vt field from style
  horizontalAlign: HorizontalAlign;    // ht field from style
  wrapStrategy: WrapStrategy;          // tb field from style
}
```

### IStylesCache (containing fontMatrix):
```ts
interface IStylesCache {
  background?: Record<colorString, ObjectMatrix<string>>;
  backgroundPositions?: ObjectMatrix<ISelectionCellWithMergeInfo>;
  font?: Record<string, ObjectMatrix<IFontCacheItem>>;
  fontMatrix: ObjectMatrix<IFontCacheItem>;   // PRIMARY: keyed by [row][col]
  border?: ObjectMatrix<BorderCache>;
}
```

**Key insight:** `IFontCacheItem` does NOT store the style (`IStyleData`) or `td` directly. The `documentSkeleton` contains a `DocumentViewModel` which holds the document model — text direction would have to be embedded in the document model during skeleton construction.

---

## 4. How Cell Style (IStyleData) Flows into FontCacheItem

### The chain (`_setStylesCacheForOneCell` → `_setFontStylesCache`):

```js
// lib/es/index.js:25703
_setStylesCacheForOneCell(row, col, options) {
  // Resolves style: composes defaultStyle + rowStyle + columnStyle + cellStyle
  const style = this._isRowStylePrecedeColumnStyle
    ? composeStyles(defaultStyle, columnStyle, rowStyle, cellStyle)
    : composeStyles(defaultStyle, rowStyle, columnStyle, cellStyle);
  this._setFontStylesCache(row, col, cell);
}

// lib/es/index.js:25674
_setFontStylesCache(row, col, cell) {
  const modelObject = this._getCellDocumentModel(cell, { displayRawFormula });
  const { documentModel, textRotation, wrapStrategy, verticalAlign, horizontalAlign } = modelObject;
  const documentViewModel = new DocumentViewModel(documentModel);
  const { vertexAngle, centerAngle } = convertTextRotation(textRotation);
  const documentSkeleton = DocumentSkeleton.create(documentViewModel, this._localService);
  documentSkeleton.calculate();
  const config = {
    documentSkeleton,  // contains the laid-out text
    vertexAngle, centerAngle,
    verticalAlign, horizontalAlign, wrapStrategy
  };
  this._stylesCache.fontMatrix.setValue(row, col, config);
}
```

### `_getCellDocumentModel` reads style via `getStyleByCell(cell)`:
```js
// lib/es/index.js:25385
_getCellDocumentModel(cell, options) {
  const style = this._styles.getStyleByCell(cell);
  const cellOtherConfig = this._getOtherStyle(style);
  // Returns: { documentModel, fontString, textRotation, wrapStrategy,
  //            verticalAlign, horizontalAlign, paddingData, fill }
}
```

### `_getOtherStyle` extracts `td` (text direction):
```js
// lib/es/index.js:25854
_getOtherStyle(format) {
  const {
    tr: textRotation,
    td: textDirection,   // <-- IStyleData.td is extracted here
    ht: horizontalAlign,
    vt: verticalAlign,
    tb: wrapStrategy,
    pd: paddingData
  } = format;
  return { textRotation, textDirection, horizontalAlign, verticalAlign, wrapStrategy, paddingData };
}
```

**CRITICAL FINDING:** `textDirection` (from `IStyleData.td`) is extracted by `_getOtherStyle` but is **NOT passed into the IFontCacheItem** and is **NOT used to configure the DocumentSkeleton or document model**. It disappears after extraction. This is the gap that the RTL plugin needs to fill.

---

## 5. How Font Iterates Visible Cells

From `draw()` at line 25938:

```js
draw(ctx, parentScale, spreadsheetSkeleton, diffRanges, moreBoundsInfo) {
  const { stylesCache, worksheet } = spreadsheetSkeleton;
  const { fontMatrix } = stylesCache;  // ObjectMatrix<IFontCacheItem>
  const { rowHeightAccumulation, columnTotalWidth, columnWidthAccumulation, rowTotalHeight } = spreadsheetSkeleton;
  const scale = this._getScale(parentScale);
  const { viewRanges = [], checkOutOfViewBound } = moreBoundsInfo;

  // Build renderFontContext
  const renderFontContext = { ctx, scale, rowHeightAccumulation, ... };

  // Step 1: iterate non-merged cells in viewRanges
  viewRanges.forEach((range) => {
    range.startColumn -= EXPAND_SIZE_FOR_RENDER_OVERFLOW;  // 20 cols extra for overflow
    range.endColumn += EXPAND_SIZE_FOR_RENDER_OVERFLOW;
    range = clampRange(range);

    // Collect unique merge ranges in viewport
    spreadsheetSkeleton.worksheet.getMergedCellRange(...).forEach(mergeRange => {
      uniqueMergeRanges.push(mergeRange);
    });

    // Iterate non-merged cells
    Range.foreach(range, (row, col) => {
      if (spreadsheetSkeleton.worksheet.getSpanModel().getMergeDataIndex(row, col) !== -1)
        return;  // skip cells that are part of a merge
      const cellInfo = spreadsheetSkeleton.getCellByIndexWithNoHeader(row, col);
      cellInfo && this.renderFontEachCell(renderFontContext, row, col, fontMatrix);
    });
  });

  // Step 2: iterate merged cells (by their top-left cell)
  uniqueMergeRanges.forEach((range) => {
    const cellInfo = spreadsheetSkeleton.getCellByIndexWithNoHeader(range.startRow, range.startColumn);
    renderFontContext.cellInfo = cellInfo;
    this.renderFontEachCell(renderFontContext, range.startRow, range.startColumn, fontMatrix);
  });
}
```

---

## 6. Accessing Spreadsheet via IRenderManagerService

### From compiled code (line 32531, 32616):
```js
// IRenderManagerService API:
getCurrentTypeOfRenderer(type: UniverInstanceType): IRender | null
getRenderById(unitId: string): IRender | undefined
getCurrent(): IRender | undefined

// IRender structure (line 32396):
interface IRender {
  unitId: string;
  engine: Engine;
  scene: Scene;
  mainComponent: Spreadsheet | null;  // The Spreadsheet instance
  components: Map<string, RenderComponent>;
  type: UniverInstanceType;
}
```

### How to get the Spreadsheet and its fontExtension:
```ts
// In a controller/service:
const render = this._renderManagerService.getCurrentTypeOfRenderer(UniverInstanceType.UNIVER_SHEET);
const spreadsheet = render?.mainComponent as Spreadsheet;
const fontExtension = spreadsheet?.fontExtension;  // getter at line 28711

// OR by unitId:
const render = this._renderManagerService.getRenderById(unitId);
const spreadsheet = render?.mainComponent as Spreadsheet;
```

### Spreadsheet.fontExtension getter (line 28711):
```js
get fontExtension() {
  return this._fontExtension;  // set in _initialDefaultExtension()
}
```

`_initialDefaultExtension()` (line 28946):
```js
_initialDefaultExtension() {
  SpreadsheetExtensionRegistry.getData().sort(sortRules).forEach((Extension) => {
    this.register(new Extension());
  });
  this._backgroundExtension = this.getExtensionByKey("DefaultBackgroundExtension");
  this._borderExtension = this.getExtensionByKey("DefaultBorderExtension");
  this._fontExtension = this.getExtensionByKey("DefaultFontExtension");
}
```

---

## 7. Monkey-Patching Strategy for RTL

To intercept `renderFontEachCell` for RTL cells:

### Option A: Replace the Font extension entirely
```ts
import { SpreadsheetExtensionRegistry } from '@univerjs/engine-render';

class RtlFontExtension extends SheetExtension {
  uKey = "DefaultFontExtension";  // same key = replaces built-in
  Z_INDEX = 45;

  renderFontEachCell(renderFontCtx, row, col, fontMatrix) {
    const { spreadsheetSkeleton } = renderFontCtx;
    const cell = spreadsheetSkeleton.worksheet.getCell(row, col);
    const style = spreadsheetSkeleton._styles.getStyleByCell(cell);

    if (style?.td === TextDirection.RIGHT_TO_LEFT) {
      // Apply RTL rendering: set ctx.direction, adjust positions
      renderFontCtx.ctx.direction = 'rtl';
      // ... custom RTL draw logic
    }
    return super.renderFontEachCell(renderFontCtx, row, col, fontMatrix);
  }
}

SpreadsheetExtensionRegistry.add(new RtlFontExtension());
```

### Option B: Monkey-patch via fontExtension getter
```ts
const render = this._renderManagerService.getCurrentTypeOfRenderer(UniverInstanceType.UNIVER_SHEET);
const spreadsheet = render?.mainComponent as Spreadsheet;
const fontExt = spreadsheet?.fontExtension as Font;

if (fontExt) {
  const originalFn = fontExt.renderFontEachCell.bind(fontExt);
  fontExt.renderFontEachCell = (ctx, row, col, fontMatrix) => {
    // Pre-hook: detect RTL for this cell
    const cell = ctx.spreadsheetSkeleton.worksheet.getCell(row, col);
    // ... modify ctx for RTL
    return originalFn(ctx, row, col, fontMatrix);
  };
}
```

---

## 8. Accessing IStyleData.td During Rendering

During `renderFontEachCell`, `td` can be accessed via:

```ts
// Method 1: from spreadsheetSkeleton
const { spreadsheetSkeleton } = renderFontCtx;
const cell = spreadsheetSkeleton.worksheet.getCell(row, col);
const style = spreadsheetSkeleton['_styles'].getStyleByCell(cell);
const textDirection = style?.td;  // TextDirection enum value

// Method 2: from cellData (already fetched in renderFontEachCell)
// cellData = spreadsheetSkeleton.worksheet.getCell(row, col) || {}
// But cellData is ICellData which doesn't have td — style must be resolved separately

// Method 3: via IFontCacheItem's documentSkeleton
const fontsConfig = fontMatrix.getValue(row, col);  // IFontCacheItem
// fontsConfig.documentSkeleton contains the pre-built DocumentSkeleton
// The underlying DocumentModel has section/paragraph direction if set
```

**Recommended approach:** Access `style.td` via `spreadsheetSkeleton.worksheet.getCell()` + `_styles.getStyleByCell()` within the custom extension's draw method.

---

## 9. Key File Locations

```
node_modules/@univerjs/engine-render/
  lib/
    types/components/sheets/
      extensions/font.d.ts         # Font class declaration + IRenderFontContext
      interfaces.d.ts              # IFontCacheItem, IStylesCache definitions
      sheet-skeleton.d.ts          # SpreadsheetSkeleton type
    es/index.js
      # line  4922: FONT_EXTENSION_Z_INDEX = 45
      # line  4410: SpreadsheetExtensionRegistry = Registry.create()
      # line 25928: Font class definition (UNIQUE_KEY$6 = "DefaultFontExtension")
      # line 25938: Font.draw() — iterates visible cells
      # line 25973: Font.renderFontEachCell() — per-cell render entry point
      # line 25854: SpreadsheetSkeleton._getOtherStyle() — extracts td but doesn't use it
      # line 25674: SpreadsheetSkeleton._setFontStylesCache() — builds IFontCacheItem
      # line 26048: Font._renderDocuments() — invokes Documents.render() on DocumentSkeleton
      # line 26071: SpreadsheetExtensionRegistry.add(Font) — auto-registration
      # line 28689: Spreadsheet class definition
      # line 28711: Spreadsheet.fontExtension getter
      # line 28946: Spreadsheet._initialDefaultExtension()
      # line 32531: RenderManagerService.getCurrentTypeOfRenderer()
      # line 32616: RenderManagerService.getRenderById()
      # line 32633: IRenderManagerService token
```

---

## 10. Summary of Findings

| Question | Answer |
|----------|--------|
| Font class Z_INDEX | 45 (constant `FONT_EXTENSION_Z_INDEX`) |
| `renderFontEachCell` params | `(renderFontCtx: IRenderFontContext, row: number, col: number, fontMatrix: ObjectMatrix<IFontCacheItem>)` |
| Does IFontCacheItem have style? | NO — only `documentSkeleton`, angles, `verticalAlign`, `horizontalAlign`, `wrapStrategy` |
| Is `td` used anywhere in rendering? | Extracted by `_getOtherStyle()` but then DISCARDED — never reaches skeleton |
| How to get Spreadsheet instance | `renderManagerService.getCurrentTypeOfRenderer(UniverInstanceType.UNIVER_SHEET)?.mainComponent` |
| How to get fontExtension | `(spreadsheet as Spreadsheet).fontExtension` |
| How cells are iterated | `Range.foreach(viewRange)` for non-merged + `uniqueMergeRanges.forEach` for merges |
| Best RTL hook point | Register custom `SheetExtension` with `uKey = "DefaultFontExtension"` via `SpreadsheetExtensionRegistry.add()` |
