# @univerjs/ui Component Structure — RTL Injection Points Research

**Package:** `@univerjs/ui@0.4.2`
**Researched:** 2026-02-27
**Researcher:** worker-1

---

## 1. Package Structure

```
node_modules/@univerjs/ui/lib/
├── cjs/index.js          # CommonJS bundle (single file)
├── es/index.js           # ESM bundle (single file)
├── index.css             # All UI styles (14 KB, single flat file)
├── types/                # TypeScript declaration files (source of truth)
│   ├── controllers/
│   │   └── ui/
│   │       ├── ui.controller.d.ts          # IWorkbenchOptions, IUIController
│   │       ├── ui-desktop.controller.d.ts  # DesktopUIController
│   │       └── ui-mobile.controller.d.ts   # MobileUIController
│   ├── services/
│   │   ├── layout/layout.service.d.ts      # ILayoutService (root container)
│   │   ├── parts/parts.service.d.ts        # IUIPartsService, BuiltInUIPart
│   │   ├── sidebar/                        # ISidebarService
│   │   ├── contextmenu/                    # IContextMenuService
│   │   └── ...
│   └── views/
│       ├── workbench/Workbench.d.ts        # DesktopWorkbench React component
│       └── components/
│           ├── ComponentContainer.d.ts     # useComponentsOfPart hook
│           ├── ribbon/                     # Ribbon, ToolbarItem, etc.
│           └── sidebar/
└── locale/               # i18n JSON files
```

---

## 2. DOM Container Hierarchy

The workbench renders into a React component tree. Based on CSS class names in `index.css` and type definitions:

```
[mountContainer HTMLElement]  ← passed to DesktopWorkbench
└── .univer-workbench-layout          # root flex column container
    ├── .univer-workbench-container   # flex-1 column
    │   ├── .univer-workbench-container-header  # z-index:10, full-width
    │   │   ├── .univer-headerbar               # user-select:none header bar
    │   │   │   └── .univer-header-menu         # absolute top-right
    │   │   ├── .univer-menubar                 # top menubar (h:32px)
    │   │   └── .univer-toolbar                 # ribbon toolbar (h:32px)
    │   │       └── .univer-toolbar-container   # toolbar items wrapper
    │   │           └── .univer-toolbar-group   # groups of toolbar buttons
    │   └── .univer-workbench-container-wrapper # grid: auto 1fr auto
    │       ├── .univer-workbench-container-left-sidebar  # left panel slot
    │       ├── .univer-workbench-container-content       # main content
    │       │   ├── .univer-workbench-container-doc-content
    │       │   └── .univer-workbench-container-canvas    # Canvas element
    │       └── .univer-workbench-container-sidebar       # right sidebar
    │           └── .univer-sidebar                       # sidebar panel
    │               ├── .univer-sidebar-header
    │               ├── .univer-sidebar-body
    │               └── .univer-sidebar-footer
    ├── .univer-zen-zone                # overlay (z-index:100 when open)
    ├── .univer-global-zone             # full-screen overlay
    └── .univer-notification            # fixed z-index:1000
```

**Mobile variant** uses `.univer-app-layout` / `.univer-app-container-*` mirroring the desktop classes.

---

## 3. React Component Tree

| Component | File | Description |
|-----------|------|-------------|
| `DesktopWorkbench` | `views/workbench/Workbench.d.ts` | Top-level, receives `mountContainer` & `onRendered` |
| `Ribbon` | `views/components/ribbon/Ribbon.d.ts` | Header + toolbar area, accepts `headerMenuComponents` |
| `ComponentContainer` | `views/components/ComponentContainer.d.ts` | Renders a `Set<ComponentType>` by part name |
| `ZenZone` | `views/components/zen-zone/ZenZone.d.ts` | Full-screen mode overlay |
| `ContextMenu` | `views/components/context-menu/ContextMenu.d.ts` | Desktop context menu |

**`IUIPartsService` / `BuiltInUIPart`** drives dynamic component injection:
```typescript
enum BuiltInUIPart {
    GLOBAL = "global",
    HEADER = "header",
    HEADER_MENU = "header-menu",
    CONTENT = "content",
    FOOTER = "footer",
    LEFT_SIDEBAR = "left-sidebar",
    FLOATING = "floating",
    UNIT = "unit"
}
```
Each workbench section renders a `<ComponentContainer>` that reads from `IUIPartsService.getComponents(part)`.

---

## 4. CSS Methodology

- **Single compiled CSS file** (`lib/index.css`, 14 KB)
- **Plain CSS with BEM-like naming** — no CSS Modules, no styled-components
- **CSS Custom Properties** (variables) for theming: `--font-size-xs`, `--padding-xl`, `--bg-color`, etc.
- **All class names are globally scoped** with the `univer-` prefix
- **No RTL/direction rules exist** anywhere in the CSS — zero hits for `rtl`, `ltr`, `direction`, or `bidi`

**Directional CSS properties found** (require RTL overrides):
- `.univer-menu-item-selectable { padding-left: var(--padding-xl) }` — icon indent
- `.univer-menu-item-selectable-icon { left: 0 }` — icon position
- `.univer-headerbar > .univer-header-menu { right: 0 }` — absolute right
- `.univer-progress-bar { margin-right: 8px }` — spacing
- `.univer-headerbar > .univer-header-menu > div { margin-left: 4px }` — spacing
- `.univer-sidebar-container { border-left: 1px solid }` — sidebar left border
- `.univer-sidebar { transform: translate(100%) }` — slides in from right
- `.univer-toolbar-item-select-button { padding-right: 18px }` — dropdown arrow space
- `.univer-toolbar-item-select-button-arrow { left: 0; padding-right: var(--padding-xs) }` — arrow position

---

## 5. Extension / Injection Points

### 5.1 `ILayoutService` — Root Container Access (BEST INJECTION POINT)

```typescript
// From @univerjs/ui
interface ILayoutService {
    get rootContainerElement(): Nullable<HTMLElement>;
    registerRootContainerElement(container: HTMLElement): IDisposable;
}
```

**The `rootContainerElement` is the `.univer-workbench-layout` div.** This is the single best place to inject `dir="rtl"` because:
- Setting `dir="rtl"` on the root container triggers CSS cascade for ALL child elements
- It also activates `[dir="rtl"]` CSS attribute selectors for targeted overrides
- Already implemented in `src/controllers/rtl-css.controller.ts` using `ILayoutService`

### 5.2 `IUIPartsService` — Component Slot Injection

```typescript
uiPartsService.registerComponent(BuiltInUIPart.HEADER_MENU, () => RtlToggleButton);
uiPartsService.registerComponent(BuiltInUIPart.FOOTER, () => RtlStatusIndicator);
```

Allows injecting React components into named slots without modifying Univer source.

### 5.3 `IMenuManagerService` — Toolbar Menu Items

```typescript
menuManagerService.appendMenu({
    id: ToggleRtlCommand.id,
    type: MenuItemType.BUTTON,
    positions: [RibbonStartGroup.FORMAT],
});
```

Injects toggle buttons into the Ribbon toolbar groups.

### 5.4 CSS `[data-u-rtl="true"]` Attribute Selector (CURRENT APPROACH)

The existing `rtl-css.controller.ts` correctly uses:
1. `container.setAttribute('data-u-rtl', 'true')` on the root container
2. A `<style>` element injected into `document.head` with `[data-u-rtl="true"]` scoped rules

This is the right pattern since inline CSS cannot be changed.

---

## 6. Existing RTL/i18n Infrastructure

**None found.** The `@univerjs/ui@0.4.2` package has:
- No `dir` attribute handling
- No `direction` CSS rules
- No RTL-aware layout logic
- No `[dir="rtl"]` selectors
- No bidi/i18n text-direction APIs

The package does have locale files (`lib/locale/`) for UI strings, but nothing related to layout direction.

---

## 7. Recommended RTL Injection Strategy

### Layer 1: UI Shell Direction (Implemented)
Target the `rootContainerElement` (`.univer-workbench-layout`):
```javascript
rootContainer.setAttribute('dir', 'rtl');
rootContainer.setAttribute('data-u-rtl', 'true');
```

### Layer 2: CSS Override Rules (Implemented, needs improvement)
Inject targeted `[data-u-rtl="true"]` CSS rules for:

```css
/* Fix toolbar direction */
[data-u-rtl="true"] .univer-toolbar-container { flex-direction: row-reverse; }

/* Fix sidebar to left side */
[data-u-rtl="true"] .univer-sidebar { transform: translate(-100%); right: auto; left: 0; }
[data-u-rtl="true"] .univer-sidebar.univer-sidebar-open { transform: translate(0); }
[data-u-rtl="true"] .univer-sidebar-container { border-left: none; border-right: 1px solid; }

/* Fix header menu to left side */
[data-u-rtl="true"] .univer-headerbar > .univer-header-menu { right: auto; left: 0; }

/* Fix menu item icon indent */
[data-u-rtl="true"] .univer-menu-item-selectable { padding-left: 0; padding-right: var(--padding-xl); }
[data-u-rtl="true"] .univer-menu-item-selectable-icon { left: auto; right: 0; }

/* Fix dropdown arrow */
[data-u-rtl="true"] .univer-toolbar-item-select-button { padding-right: 0; padding-left: 18px; }
[data-u-rtl="true"] .univer-toolbar-item-select-button-arrow { left: auto; right: 0; }
```

### Layer 3: Canvas/Render Pipeline
Canvas rendering is separate — the `@univerjs/engine-render` pipeline handles cell text drawing and must be addressed independently (see worker-3 research).

### Layer 4: Formula Bar
The formula bar is likely rendered via a separate plugin (`@univerjs/sheets-formula`). It injects into the `BuiltInUIPart.CONTENT` slot and needs `dir="rtl"` applied via the content container.

---

## 8. Key Exported APIs for RTL Plugin Use

```typescript
// Services available via dependency injection
import {
    ILayoutService,        // rootContainerElement getter
    IUIPartsService,       // registerComponent(part, factory)
    BuiltInUIPart,         // HEADER_MENU, FOOTER, LEFT_SIDEBAR, etc.
    IMenuManagerService,   // appendMenu()
    IContextMenuService,   // context menu control
    ISidebarService,       // sidebar.open/close
} from '@univerjs/ui';
```

---

## 9. Summary

| Area | Best Injection Method | Status |
|------|----------------------|--------|
| Root container `dir` attribute | `ILayoutService.rootContainerElement` | Done in `rtl-css.controller.ts` |
| Toolbar/ribbon direction | CSS `[data-u-rtl]` rules | Partial (needs specific classes) |
| Sidebar mirroring | CSS `[data-u-rtl]` rules | Partial (transform direction wrong) |
| Menu item icons | CSS `[data-u-rtl]` rules | Missing |
| Toolbar button injection | `IUIPartsService.registerComponent` | Partial via `IMenuManagerService` |
| Canvas cell text | `@univerjs/engine-render` hooks | Not yet (worker-3 researching) |
| Formula bar | Content slot `dir` propagation | Inherits from root `dir` |
