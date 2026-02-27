/**
 * RtlStatusIndicator — a small DOM pill/badge injected into the footer area.
 * Shows "RTL" when RTL mode is active, "LTR" otherwise.
 * Clicking it toggles RTL mode by executing ToggleRtlCommand.
 */

export interface IRtlStatusIndicatorOptions {
    /** Initial enabled state */
    enabled: boolean;
    /** Called when user clicks the badge */
    onClick: () => void;
}

const INDICATOR_ID = 'univer-rtl-status-indicator';

const BASE_STYLES: Partial<CSSStyleDeclaration> = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: 'monospace',
    cursor: 'pointer',
    userSelect: 'none',
    border: '1px solid transparent',
    marginLeft: '8px',
    marginRight: '8px',
    lineHeight: '16px',
    height: '20px',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
};

const RTL_STYLES = {
    background: '#e8f4fd',
    color: '#1a73e8',
    borderColor: '#1a73e8',
};

const LTR_STYLES = {
    background: '#f5f5f5',
    color: '#757575',
    borderColor: '#bdbdbd',
};

export class RtlStatusIndicator {
    private _element: HTMLElement | null = null;
    private _enabled: boolean;
    private _onClick: () => void;

    constructor(options: IRtlStatusIndicatorOptions) {
        this._enabled = options.enabled;
        this._onClick = options.onClick;
    }

    /** Create the DOM element (idempotent — returns existing if already created). */
    createElement(): HTMLElement {
        if (this._element) return this._element;

        const el = document.createElement('span');
        el.id = INDICATOR_ID;
        el.title = 'Click to toggle RTL / LTR mode';

        // Apply base styles
        Object.assign(el.style, BASE_STYLES);

        el.addEventListener('click', () => this._onClick());
        el.addEventListener('mouseenter', () => {
            el.style.opacity = '0.8';
        });
        el.addEventListener('mouseleave', () => {
            el.style.opacity = '1';
        });

        this._element = el;
        this._applyState();
        return el;
    }

    /** Update the badge to reflect the current RTL enabled state. */
    update(enabled: boolean): void {
        this._enabled = enabled;
        this._applyState();
    }

    /** Remove the element from the DOM and clean up. */
    destroy(): void {
        if (this._element) {
            this._element.remove();
            this._element = null;
        }
    }

    private _applyState(): void {
        if (!this._element) return;
        const styles = this._enabled ? RTL_STYLES : LTR_STYLES;
        this._element.textContent = this._enabled ? 'RTL' : 'LTR';
        Object.assign(this._element.style, styles);
    }
}
