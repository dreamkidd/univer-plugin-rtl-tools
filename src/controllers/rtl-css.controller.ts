import { Disposable, Inject, Injector, LifecycleStages, OnLifecycle } from '@univerjs/core';
import { ILayoutService } from '@univerjs/ui';

const RTL_STYLE_ID = 'univer-rtl-tools-styles';

const RTL_CSS_RULES = `
/* RTL mode: root workbench layout */
[data-u-rtl="true"].univer-workbench-layout {
    direction: rtl;
}

/* RTL mode: toolbar — reverse button order */
[data-u-rtl="true"] .univer-toolbar-container {
    direction: rtl;
    flex-direction: row-reverse;
}
[data-u-rtl="true"] .univer-toolbar-group {
    direction: rtl;
}
[data-u-rtl="true"] .univer-toolbar-item-select-button {
    padding-right: 0;
    padding-left: 18px;
}
[data-u-rtl="true"] .univer-toolbar-item-select-button-arrow {
    left: auto;
    right: 0;
}

/* RTL mode: header bar — menu to left side */
[data-u-rtl="true"] .univer-headerbar > .univer-header-menu {
    right: auto;
    left: 0;
}
[data-u-rtl="true"] .univer-headerbar > .univer-header-menu > div {
    margin-left: 0;
    margin-right: 4px;
}

/* RTL mode: sidebar — move to left side */
[data-u-rtl="true"] .univer-sidebar {
    transform: translate(-100%);
    right: auto;
    left: 0;
}
[data-u-rtl="true"] .univer-sidebar.univer-sidebar-open {
    transform: translate(0);
}
[data-u-rtl="true"] .univer-sidebar-container {
    border-left: none;
    border-right: 1px solid var(--border-color, #e0e0e0);
}

/* RTL mode: workbench grid layout — swap sidebar positions */
[data-u-rtl="true"] .univer-workbench-container-wrapper {
    direction: rtl;
}

/* RTL mode: menu items — flip icon indent */
[data-u-rtl="true"] .univer-menu-item-selectable {
    padding-left: 0;
    padding-right: var(--padding-xl, 24px);
}
[data-u-rtl="true"] .univer-menu-item-selectable-icon {
    left: auto;
    right: 0;
}

/* RTL mode: context menus and dropdowns */
[data-u-rtl="true"] .univer-menu,
[data-u-rtl="true"] .univer-dropdown {
    direction: rtl;
    text-align: right;
}

/* RTL mode: formula bar */
[data-u-rtl="true"] .univer-formula-bar,
[data-u-rtl="true"] [class*="formulaBar"] {
    direction: rtl;
    text-align: right;
}

/* RTL mode: sheet tabs — align to right */
[data-u-rtl="true"] [class*="sheet-tab"],
[data-u-rtl="true"] [class*="sheetTab"] {
    direction: rtl;
}

/* RTL mode: progress bar spacing */
[data-u-rtl="true"] .univer-progress-bar {
    margin-right: 0;
    margin-left: 8px;
}
`.trim();

@OnLifecycle(LifecycleStages.Rendered, RtlCssController)
export class RtlCssController extends Disposable {
    private _enabled = false;
    private _styleElement: HTMLStyleElement | null = null;

    constructor(
        @Inject(Injector) private readonly _injector: Injector,
        @Inject(ILayoutService) private readonly _layoutService: ILayoutService
    ) {
        super();

        this.disposeWithMe({
            dispose: () => this._cleanup(),
        });
    }

    get isEnabled(): boolean {
        return this._enabled;
    }

    enable(): void {
        if (this._enabled) return;
        this._enabled = true;
        this._injectStyles();
        this._setDirAttribute('rtl');
    }

    disable(): void {
        if (!this._enabled) return;
        this._enabled = false;
        this._removeStyles();
        this._setDirAttribute('ltr');
    }

    toggle(): void {
        if (this._enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    private _getRootContainer(): HTMLElement | null {
        return this._layoutService.rootContainerElement ?? null;
    }

    private _injectStyles(): void {
        if (this._styleElement) return;

        const styleEl = document.createElement('style');
        styleEl.id = RTL_STYLE_ID;
        styleEl.textContent = RTL_CSS_RULES;
        document.head.appendChild(styleEl);
        this._styleElement = styleEl;
    }

    private _removeStyles(): void {
        if (this._styleElement) {
            this._styleElement.remove();
            this._styleElement = null;
        }

        // Also remove by ID in case of duplicate
        const existing = document.getElementById(RTL_STYLE_ID);
        if (existing) {
            existing.remove();
        }
    }

    private _setDirAttribute(dir: 'rtl' | 'ltr'): void {
        const container = this._getRootContainer();
        if (container) {
            if (dir === 'rtl') {
                container.setAttribute('dir', 'rtl');
                container.setAttribute('data-u-rtl', 'true');
            } else {
                container.removeAttribute('dir');
                container.removeAttribute('data-u-rtl');
            }
        }
    }

    private _cleanup(): void {
        this._removeStyles();

        const container = this._getRootContainer();
        if (container) {
            container.removeAttribute('dir');
            container.removeAttribute('data-u-rtl');
        }

        this._enabled = false;
    }
}
