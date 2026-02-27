import { Disposable, Inject } from '@univerjs/core';
import { ICommandService } from '@univerjs/core';
import { ILayoutService } from '@univerjs/ui';
import { RtlCssController } from './rtl-css.controller';
import { ToggleRtlCommand } from '../commands/toggle-rtl.command';
import { RtlStatusIndicator } from '../views/rtl-status-indicator';

/**
 * RtlStatusController — manages the lifecycle of the RTL status badge.
 *
 * It injects a small pill indicator into the Univer footer/statusbar area.
 * The indicator shows the current direction mode (RTL / LTR) and can be
 * clicked to toggle it via ToggleRtlCommand.
 */
export class RtlStatusController extends Disposable {
    private _indicator: RtlStatusIndicator | null = null;

    constructor(
        @Inject(ILayoutService) private readonly _layoutService: ILayoutService,
        @Inject(ICommandService) private readonly _commandService: ICommandService,
        @Inject(RtlCssController) private readonly _rtlCssController: RtlCssController
    ) {
        super();

        this._initIndicator();

        // Re-render badge whenever any command executes (lightweight check)
        this.disposeWithMe(
            this._commandService.onCommandExecuted((info) => {
                if (info.id === ToggleRtlCommand.id) {
                    this._indicator?.update(this._rtlCssController.isEnabled);
                }
            })
        );

        this.disposeWithMe({
            dispose: () => this._destroyIndicator(),
        });
    }

    private _initIndicator(): void {
        const indicator = new RtlStatusIndicator({
            enabled: this._rtlCssController.isEnabled,
            onClick: () => {
                this._commandService.executeCommand(ToggleRtlCommand.id);
            },
        });

        const el = indicator.createElement();
        this._indicator = indicator;

        // Try to mount into the footer / statusbar.
        // The Univer workbench renders a `.univer-workbench-layout` which may contain
        // a statusbar. We fall back to appending directly to the root container.
        const mounted = this._mountElement(el);
        if (!mounted) {
            console.warn('[RtlStatusController] Could not find footer container; badge not mounted.');
        }
    }

    private _mountElement(el: HTMLElement): boolean {
        const root = this._layoutService.rootContainerElement;
        if (!root) return false;

        // Try known footer / statusbar selectors first
        const footerSelectors = [
            '.univer-footer',
            '.univer-statusbar',
            '.univer-workbench-footer',
            '[class*="footer"]',
            '[class*="statusbar"]',
            '[class*="status-bar"]',
        ];

        for (const selector of footerSelectors) {
            const footer = root.querySelector(selector);
            if (footer) {
                footer.appendChild(el);
                return true;
            }
        }

        // Fallback: append a small floating badge anchored to the bottom-right of root
        this._applyFloatingStyles(el);
        root.appendChild(el);
        return true;
    }

    /**
     * When no footer DOM node exists, render the badge as a floating element
     * anchored to the bottom-right corner of the Univer workbench container.
     */
    private _applyFloatingStyles(el: HTMLElement): void {
        el.style.position = 'absolute';
        el.style.bottom = '8px';
        el.style.right = '12px';
        el.style.zIndex = '100';
        el.style.marginLeft = '0';
        el.style.marginRight = '0';
    }

    private _destroyIndicator(): void {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
