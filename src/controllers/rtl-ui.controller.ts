import { Disposable, Inject } from '@univerjs/core';
import { ICommandService } from '@univerjs/core';
import { IMenuManagerService } from '@univerjs/ui';
import { ToggleRtlCommand } from '../commands/toggle-rtl.command';
import { isRTLDominant } from '../utils/rtl-detector';
import { RTL_MENU_SCHEMA } from './menu/rtl-menu';

export class RtlUIController extends Disposable {
    constructor(
        @Inject(ICommandService) private readonly _commandService: ICommandService,
        @Inject(IMenuManagerService) private readonly _menuManagerService: IMenuManagerService
    ) {
        super();
        this._initCommands();
        this._initMenuItems();
        this._initListeners();
    }

    private _initCommands(): void {
        this.disposeWithMe(
            this._commandService.registerCommand(ToggleRtlCommand)
        );
    }

    private _initMenuItems(): void {
        this._menuManagerService.mergeMenu(RTL_MENU_SCHEMA);
    }

    private _initListeners(): void {
        this.disposeWithMe(
            this._commandService.onCommandExecuted((commandInfo) => {
                if (commandInfo.id === 'sheet.mutation.set-range-values') {
                    const mockTypedText = 'مرحبا بالعالم';
                    if (isRTLDominant(mockTypedText)) {
                        console.log('[RtlToolsPlugin] Detected RTL language input!');
                    }
                }
            })
        );
    }
}
