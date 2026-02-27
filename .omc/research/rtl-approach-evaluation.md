# RTL Rendering Approach Evaluation

**Date:** 2026-02-27
**Researcher:** worker-4
**Scope:** Evaluate Univer extension points for RTL cell text rendering

---

## Summary of Findings

The `@univerjs/engine-render` package exposes a well-defined extension system for sheet rendering. Key classes:

- `ComponentExtension<T,U,V>` — base class for all rendering extensions
- `SheetExtension extends ComponentExtension<SpreadsheetSkeleton, SHEET_EXTENSION_TYPE, IRange[]>` — base for sheet cell extensions
- `SpreadsheetExtensionRegistry: Registry<any>` — static registry for adding custom extensions
- `RenderComponent.register(...extensions)` — instance-level registration returning `IDisposable`
- `Registry<T>` — simple add/delete/getData container (from `@univerjs/core`)
- `registerRenderModule(type, dep)` — register render-scoped DI modules

Existing built-in extensions (all extend `SheetExtension`):
| Extension | Z_INDEX | Purpose |
|-----------|---------|---------|
| `Background` | 21 | Cell background fill |
| `Font` | 45 | **Text rendering (critical for RTL)** |
| `Border` | 50 | Cell borders |
| `Marker` | custom | Cell corner markers |
| `Custom` | custom | Generic custom rendering hook |

The `Font` extension's `draw()` method calls `renderFontEachCell()` per cell with full access to `UniverRenderingContext` (which exposes `direction: CanvasDirection` and `textAlign: CanvasTextAlign`).

The `UniverRenderingContext2D` wraps `CanvasRenderingContext2D` and exposes:
- `ctx.direction` — settable to `'rtl'` or `'ltr'`
- `ctx.textAlign` — settable for alignment
- `ctx.fillText()`, `ctx.fillTextPrecision()` — text draw methods

---

## Approach Evaluations

### Approach 1: Plugin Extension (Custom SheetExtension)

**Description:** Register a custom `SheetExtension` subclass via `SpreadsheetExtensionRegistry` that intercepts cell text rendering and applies RTL layout.

**How it works:**
```typescript
class RtlFontExtension extends SheetExtension {
    uKey = 'rtl-font-override';
    Z_INDEX = 46; // Just above Font (45), or replace Font at 45

    draw(ctx, parentScale, skeleton, diffRanges, drawInfo) {
        // Per-cell: detect RTL text, set ctx.direction = 'rtl', reposition text
        ctx.save();
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        // ... render text using bidi-js reordering
        ctx.restore();
    }
}

// Registration
SpreadsheetExtensionRegistry.add(new RtlFontExtension());
// Or per-spreadsheet instance:
spreadsheet.register(new RtlFontExtension());
```

**Ratings:**
| Criterion | Score | Notes |
|-----------|-------|-------|
| Feasibility | 4/5 | Registry + `register()` API is public and typed |
| Maintenance | 5/5 | No core modification; upgrades are safe |
| Completeness | 3/5 | Cannot suppress built-in Font rendering; need Z_INDEX trick or duplicate draw |

**Limitation:** The built-in `Font` extension at Z_INDEX=45 still runs. A custom extension at Z_INDEX=46 would draw on top but can't prevent the original Font draw. To replace Font rendering, you'd need to obtain the `Spreadsheet` instance and call `spreadsheet.fontExtension` to interact with it, but overriding its `draw` method requires monkey-patching.

**Verdict:** Best for adding RTL _overlay_ or _marker_ behavior. Incomplete for full RTL text reordering unless combined with canvas clipping.

---

### Approach 2: Monkey-Patching

**Description:** At runtime, replace the `draw` method on the `Font` extension instance obtained via `spreadsheet.fontExtension`.

**How it works:**
```typescript
// Access the spreadsheet render object
const spreadsheet = renderUnit.mainComponent as Spreadsheet;
const fontExt = spreadsheet.fontExtension; // public getter

const originalDraw = fontExt.draw.bind(fontExt);
fontExt.draw = function(ctx, parentScale, skeleton, diffRanges, drawInfo) {
    // Pre-hook: detect RTL cells
    // Modified draw with ctx.direction / bidi-reordering
    originalDraw(ctx, parentScale, skeleton, diffRanges, drawInfo);
};
```

**Ratings:**
| Criterion | Score | Notes |
|-----------|-------|-------|
| Feasibility | 4/5 | `fontExtension` is a public getter on `Spreadsheet`; method is public |
| Maintenance | 2/5 | Breaks on any Font class refactor; no TypeScript guarantees |
| Completeness | 5/5 | Full control over Font rendering pipeline |

**Key risk:** Univer upgrades may change the Font extension signature or rendering logic, silently breaking RTL rendering. Need version-pinning and regression tests.

**Verdict:** Achieves full completeness but is fragile. Acceptable if paired with strict version constraints.

---

### Approach 3: Fork Approach

**Description:** Fork `@univerjs/engine-render` (specifically `Font` extension and `SpreadsheetSkeleton`) to add RTL as a first-class concern.

**Minimal changes needed:**
1. `Font.renderFontEachCell()` — add RTL direction detection and `ctx.direction` switching
2. `SpreadsheetSkeleton` — add RTL cell metadata to `IFontCacheItem` (currently `{ documentSkeleton, verticalAlign, horizontalAlign, wrapStrategy }`)
3. `IStyleData` (in `@univerjs/core`) — add `textDirection?: 'rtl' | 'ltr'` field
4. Sheet skeleton's `getOverflowPosition()` — handle RTL overflow direction

**Ratings:**
| Criterion | Score | Notes |
|-----------|-------|-------|
| Feasibility | 3/5 | Requires maintaining a fork of engine-render |
| Maintenance | 1/5 | Must track upstream; high merge conflict risk |
| Completeness | 5/5 | Perfect RTL integration including overflow, skeleton, style |

**Files to fork (minimum viable):**
- `packages/engine-render/src/components/sheets/extensions/font.ts`
- `packages/engine-render/src/components/sheets/sheet-skeleton.ts`

**Verdict:** Best completeness but highest maintenance burden. Only justified if contributing back upstream.

---

### Approach 4: Combined Approach (Recommended)

**Description:** Use the plugin extension system for what's possible (cell-level RTL overlay + bidi text reordering) and minimal monkey-patching for Font draw interception. No fork required.

**Architecture:**

```
RTL Plugin
├── RtlCssController              (existing - UI direction CSS)
└── RtlRenderController           (new - render-layer RTL)
    └── RtlFontAndBaseLineExtension  (replaces built-in FontAndBaseLine via uKey)
        ├── uKey = 'DefaultDocsFontAndBaseLineExtension'  (replaces built-in)
        ├── detect RTL per glyph via isRTLDominant(glyph.content)
        ├── mirror glyph.left: adjustedX = divideWidth - glyph.left - glyph.width
        ├── set ctx.direction = 'rtl', ctx.textAlign = 'right' for RTL glyphs
        └── use bidi-js for mixed-direction text run reordering
```

**Strategy detail (no monkey-patching needed):**
1. Create `RtlFontAndBaseLineExtension extends docExtension` with `uKey = 'DefaultDocsFontAndBaseLineExtension'`
2. Register via `DocumentsSpanAndLineExtensionRegistry.add(new RtlFontAndBaseLineExtension())` — this replaces the built-in `FontAndBaseLine` for all `Documents` instances
3. In `draw()`, for LTR glyphs: delegate to original logic; for RTL glyphs: apply mirrored positions + bidi reordering
4. Access divide width from `this.extensionOffset` to compute mirrored X position

**Ratings:**
| Criterion | Score | Notes |
|-----------|-------|-------|
| Feasibility | 5/5 | uKey replacement is a documented pattern; fully public API |
| Maintenance | 4/5 | Extension is isolated; only breaks if uKey string changes upstream |
| Completeness | 5/5 | Full control over glyph draw; works for all Documents instances |

---

## Comparison Matrix

| Approach | Feasibility | Maintenance | Completeness | Recommended? |
|----------|-------------|-------------|--------------|--------------|
| 1. Plugin Extension only | 4 | 5 | 3 | Partial |
| 2. Monkey-patching only | 4 | 2 | 5 | Risky |
| 3. Fork | 3 | 1 | 5 | No |
| **4. Combined (Extension + uKey Override)** | **5** | **4** | **5** | **YES** |

---

## Recommended Implementation Plan

### Phase 1: Font Extension Interception (monkey-patch)
- Obtain `Spreadsheet` via `IRenderManagerService.getRenderById(unitId)`
- Access `spreadsheet.fontExtension`
- Wrap `renderFontEachCell` to detect RTL cells and:
  - Call `bidi-js` to get visual text order
  - Set `ctx.direction = 'rtl'`, `ctx.textAlign = 'right'`
  - Draw reordered text

### Phase 2: Bidi Text Reordering
- Already have `bidi-js` integrated (from recent commit `4f87992`)
- Apply visual reordering in the patched `renderFontEachCell`

### Phase 3: Cell-level RTL Detection
- Use existing `isRTLDominant()` utility (from commit `3777519`)
- Detect per-cell on skeleton build or on draw

### Answers from render-pipeline.md (task #3)

**DocumentSkeleton and bidi:** The skeleton computes `glyph.left` positions strictly LTR. There is **no bidi reordering** in the layout pipeline. `TextDirection.RIGHT_TO_LEFT` exists in the model (`IStyleData.td`, `IParagraphStyle.direction`) but is **never read** during rendering.

**`ctx.direction` is never set:** `UniverRenderingContext` exposes `direction: CanvasDirection` as a passthrough setter, but no code in the pipeline sets it to `'rtl'`.

**Best intervention point is `DocumentsSpanAndLineExtensionRegistry`:** The docs extension system (used inside `Font.renderFontEachCell` via `Documents.draw()`) allows replacing `FontAndBaseLine` by registering an extension with the same `uKey = 'DefaultDocsFontAndBaseLineExtension'`. This is **non-invasive and completely replaces** the built-in font draw — no monkey-patching needed.

**Revised recommended approach:**
1. Register a replacement `FontAndBaseLine` extension via `DocumentsSpanAndLineExtensionRegistry`
2. In `draw(ctx, parentScale, glyph)`, detect RTL content using `isRTLDominant(glyph.content)`
3. Mirror glyph position: `adjustedX = divideWidth - glyph.left - glyph.width`
4. Set `ctx.direction = 'rtl'` and `ctx.textAlign = 'right'` for RTL glyphs
5. Use `bidi-js` for visual reordering of mixed-direction text runs

**No monkey-patching required** — the `uKey` collision mechanism in `RenderComponent.register()` handles replacement cleanly.

---

## Key Files for Implementation

| File | Purpose |
|------|---------|
| `node_modules/@univerjs/engine-render/lib/types/components/extension.d.ts` | `SpreadsheetExtensionRegistry`, `ComponentExtension` |
| `node_modules/@univerjs/engine-render/lib/types/components/sheets/extensions/font.d.ts` | `Font` extension (key target) |
| `node_modules/@univerjs/engine-render/lib/types/components/sheets/spreadsheet.d.ts` | `Spreadsheet.fontExtension` getter |
| `node_modules/@univerjs/engine-render/lib/types/context.d.ts` | `ctx.direction`, `ctx.textAlign` |
| `node_modules/@univerjs/engine-render/lib/types/render-manager/render-manager.service.d.ts` | `IRenderManagerService` for accessing render units |
| `src/controllers/rtl-css.controller.ts` | Existing CSS layer (keep as-is) |
