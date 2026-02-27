# @univerjs/engine-render Text Rendering Pipeline Research

**Package version:** `@univerjs/engine-render@0.4.2`
**Research date:** 2026-02-27

---

## 1. Architecture Overview

The rendering pipeline flows:

```
DocumentDataModel
  → DocumentViewModel  (DataStreamTreeNode tree)
    → DocumentSkeleton.calculate()  (layout: pages → sections → columns → lines → divides → glyphs)
      → Documents.draw()  (renders via Extension system)
        → FontAndBaseLine.draw()  (calls ctx.fillText)
```

---

## 2. How Text is Drawn on Canvas

### Primary fillText call

Located in `FontAndBaseLine` extension (`lib/es/index.js` line ~28094):

```js
// lib/es/index.js:28094
ctx.fillText(content, spanPointWithFont.x, spanPointWithFont.y);
```

There is also a rotated variant for vertical text (line ~28081):
```js
// For vertical (90-degree) text
ctx.save();
ctx.translate(spanStartPoint.x + centerPoint.x, spanStartPoint.y + centerPoint.y);
ctx.rotate(Math.PI / 2);
ctx.translate(-width / 2, (aba + abd) / 2 - abd);
ctx.fillText(content, 0, 0);
ctx.restore();
```

### Canvas context wrapper

`UniverRenderingContext` (extends `UniverRenderingContext2D`) wraps the native `CanvasRenderingContext2D`. It passes through `fillText` directly to `this._context.fillText(text, x, y)`.

- **Crucially:** The `direction` property is exposed as a getter/setter on `UniverRenderingContext2D` and delegates to `this._context.direction`. This means `ctx.direction = 'rtl'` is possible in principle, but **nothing in the current code sets it**.

---

## 3. DocumentSkeleton: Layout Engine

`DocumentSkeleton` (`lib/types/components/docs/layout/doc-skeleton.d.ts`) is the core layout class.

### Hierarchy produced by `calculate()`:

```
IDocumentSkeletonCached
  └── pages: IDocumentSkeletonPage[]
        └── sections: IDocumentSkeletonSection[]
              └── columns: IDocumentSkeletonColumn[]
                    └── lines: IDocumentSkeletonLine[]
                          └── divides: IDocumentSkeletonDivide[]
                                └── glyphGroup: IDocumentSkeletonGlyph[]
```

### Key glyph fields:
```ts
interface IDocumentSkeletonGlyph {
  content: string;      // the character(s) to render
  left: number;         // x offset within divide
  width: number;        // glyph width
  xOffset: number;      // additional x adjustment
  bBox: IDocumentSkeletonBoundingBox;  // font metrics (ascent, descent, etc.)
  ts?: ITextStyle;      // text style
  fontStyle?: IDocumentSkeletonFontStyle;  // { fontString, fontSize, ... }
}
```

### Font metrics (`FontCache`):
- `FontCache.getTextSize(content, fontStyle)` measures characters using `ctx.measureText()`
- Caches results in `_globalFontMeasureCache` (Map<fontStyle, Map<content, metrics>>)
- Returns `IDocumentSkeletonBoundingBox` with `width`, `ba` (baseline ascent), `bd` (descent), etc.
- Uses `measureText` via `getTextSizeByDom()` for fallback

---

## 4. Text Shaping Pipeline

Text goes through shaping before being laid out:

1. **`shaping()`** (`layout/block/paragraph/shaping.d.ts`) - converts text content to `IShapedText[]` containing pre-broken glyph runs
2. **`textShape()`** (`layout/shaping-engine/text-shaping.d.ts`) - uses `opentype.js` to get glyph info per character, including kerning and bounding boxes
3. **`FontCache.getBBoxFromGlyphInfo()`** - converts opentype glyph info to `IDocumentSkeletonBoundingBox`

The opentype.js `Font.stringToGlyphs()` internally uses a `Bidi` object from opentype.js, but this is only for font lookup (which glyph index maps to which character), **not for visual reordering**.

---

## 5. Text Direction: Existing Model Support

### Core enum (`@univerjs/core`):
```ts
// lib/types/types/enum/text-style.d.ts
enum TextDirection {
  UNSPECIFIED = 0,
  LEFT_TO_RIGHT = 1,
  RIGHT_TO_LEFT = 2
}
```

### Where direction is stored in the document model:

1. **Section-level** (`ISectionBreakBase`):
   ```ts
   contentDirection?: TextDirection;   // overall section direction
   textDirection?: TextDirectionType;  // NORMAL | TBRL | LRTBV (orientation, not RTL)
   ```

2. **Paragraph-level** (`IParagraphStyle`):
   ```ts
   direction?: TextDirection;  // RTL or LTR for a paragraph
   ```

3. **Cell-level** (`IStyleData`):
   ```ts
   td?: TextDirection;  // text direction for spreadsheet cells
   ```

### How direction flows into layout:

The `prepareSectionBreakConfig()` function (`lib/es/index.js` line ~7420) extracts `contentDirection` and `textDirection` from section breaks and passes them into `ISectionBreakConfig`, which is threaded through `ILayoutContext` → `dealWidthParagraph()` → `shaping()`.

**However:** Inspecting the `draw()` method of `Documents` (lines 28214–28440), there is **no logic that reverses glyph order or adjusts `left` positions** based on `contentDirection` or `TextDirection.RIGHT_TO_LEFT`. The `spanPointWithFont.x` and `glyph.left` values are computed LTR by the skeleton and used as-is.

---

## 6. Extension Point System

This is the primary mechanism for customizing rendering behavior.

### Global registries (singletons):

```ts
// lib/es/index.js:4410
const DocumentsSpanAndLineExtensionRegistry = Registry.create();
const SpreadsheetExtensionRegistry = Registry.create();
const SheetRowHeaderExtensionRegistry = Registry.create();
const SheetColumnHeaderExtensionRegistry = Registry.create();
```

### Built-in document extensions (auto-registered):

| Extension | uKey | Z_INDEX | Type |
|-----------|------|---------|------|
| `Background` | `DefaultDocsBackgroundExtension` | (low) | SPAN |
| `Border` | `DefaultDocsBorderExtension` | (mid) | SPAN |
| `FontAndBaseLine` | `DefaultDocsFontAndBaseLineExtension` | 20 | SPAN |
| `Line` | `DefaultDocsLineExtension` | 40 | SPAN |

### How to add a custom extension:

```ts
// Extend docExtension (or ComponentExtension)
class MyRTLExtension extends docExtension {
  uKey = 'MyRTLExtension';
  type = DOCS_EXTENSION_TYPE.SPAN;
  Z_INDEX = 25; // render after FontAndBaseLine (20)

  draw(ctx: UniverRenderingContext, parentScale: IScale, glyph: IDocumentSkeletonGlyph): void {
    // Custom drawing logic here
  }
}

// Register globally so all Documents instances pick it up
DocumentsSpanAndLineExtensionRegistry.add(new MyRTLExtension());

// OR register on a specific Documents instance
documents.register(new MyRTLExtension());
```

### How extensions are invoked per-glyph (from `Documents.draw()`):

```js
// lib/es/index.js:28393-28394
for (const extension of glyphExtensionsExcludeBackground) {
  extension.extensionOffset = extensionOffset;  // includes spanPointWithFont, renderConfig, etc.
  extension.draw(ctx, parentScale, glyph);
}
```

The `extensionOffset` object passed to each extension contains:
- `originTranslate: Vector2` - cumulative page/section/column/line translation
- `spanStartPoint: Vector2` - glyph start position (post-rotation math)
- `spanPointWithFont: Vector2` - baseline drawing position
- `centerPoint: Vector2` - glyph center
- `alignOffset: Vector2` - horizontal/vertical alignment offset
- `renderConfig: IDocumentRenderConfig` - cell render config (rotation, alignment, etc.)

### Override mechanism:

To replace `FontAndBaseLine` entirely, register a new extension with the **same `uKey`**:
```ts
DocumentsSpanAndLineExtensionRegistry.add(new MyExtension());
// uKey 'DefaultDocsFontAndBaseLineExtension' → map key collision replaces existing
```

Or call `documents.register(myExtension)` where `myExtension.uKey` matches an existing key.

---

## 7. RTL Gap Analysis

### What EXISTS in the model:
- `TextDirection.RIGHT_TO_LEFT` enum value
- `contentDirection` on sections
- `direction` on paragraphs

### What is MISSING in the render pipeline:
1. **No visual reordering of glyphs** - the skeleton computes `glyph.left` positions left-to-right; there is no bidi algorithm applied to reorder runs for display
2. **`ctx.direction` never set to `'rtl'`** - the canvas direction property exists on `UniverRenderingContext` but is not set based on document direction
3. **No line-level RTL alignment** - `IDocumentSkeletonLine` has no direction field; lines are always rendered LTR
4. **No paragraph-level direction detection** - `direction` field in `IParagraphStyle` is not read during layout to adjust glyph positions
5. **`textDirection` field is layout orientation** - `TextDirectionType` (NORMAL/TBRL/LRTBV) controls horizontal vs. vertical writing, not RTL/LTR

---

## 8. Recommended RTL Intervention Points

### Option A: Custom `docExtension` to intercept drawing (non-invasive)
- Register a replacement `FontAndBaseLine` extension via `DocumentsSpanAndLineExtensionRegistry`
- In the extension's `draw()`, detect RTL content (using the project's `detectRTL()` logic)
- Apply mirroring by adjusting `spanPointWithFont.x` using the divide width, effectively reversing the draw position

### Option B: Post-skeleton glyph reordering
- After `DocumentSkeleton.calculate()`, walk the skeleton tree
- For RTL divides, reverse `glyph.left` positions within each divide
- This is more correct but requires hooking into skeleton lifecycle

### Option C: Set `ctx.direction = 'rtl'` before fillText
- Only works if font is bidirectional and browser handles reflow
- Unreliable for complex RTL text in canvas; not recommended as sole solution

### Option D: Pre-layout text reordering (existing plugin approach)
- The project already uses `bidi-js` (see `src/` plugin code)
- Reorder the content string before it reaches skeleton layout
- Most compatible with the existing architecture

---

## 9. Key File Paths

```
node_modules/@univerjs/engine-render/
  lib/
    types/
      context.d.ts                                    # UniverRenderingContext (wraps CanvasRenderingContext2D)
      components/
        extension.d.ts                                # ComponentExtension base + registries
        skeleton.d.ts                                 # Skeleton base class
        docs/
          doc-extension.d.ts                          # docExtension (SPAN | LINE type)
          document.d.ts                               # Documents component (main draw loop)
          layout/
            doc-skeleton.d.ts                         # DocumentSkeleton.calculate()
            tools.d.ts                                # ILayoutContext, prepareSectionBreakConfig
            block/paragraph/
              shaping.d.ts                            # shaping() entry point
              paragraph-layout.d.ts                   # dealWidthParagraph()
            shaping-engine/
              text-shaping.d.ts                       # textShape() via opentype.js
              font-cache.d.ts                         # FontCache.getTextSize / getMeasureText
          extensions/
            font-and-base-line.d.ts                   # FontAndBaseLine (primary fillText)
            line.d.ts                                 # underline/strikethrough
            border.d.ts                               # border rendering
            background.d.ts                           # background fill
    es/index.js                                       # Full implementation (minified)
      # FontAndBaseLine._fillText: line ~28074
      # FontAndBaseLine.draw: line ~28059
      # Documents.draw: line ~28214
      # RenderComponent.register: line ~4356
      # DocumentsSpanAndLineExtensionRegistry: line ~4410

node_modules/@univerjs/core/
  lib/types/types/
    enum/text-style.d.ts                              # TextDirection enum (LTR=1, RTL=2)
    interfaces/i-document-data.d.ts                  # TextDirectionType, contentDirection, direction
    interfaces/i-style-data.d.ts                     # IStyleData.td (cell text direction)
```
