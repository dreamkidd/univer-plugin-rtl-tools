import { Inject, Injector, LifecycleStages, OnLifecycle } from '@univerjs/core';
import { ICommandService } from '@univerjs/core';
import { IMenuManagerService, MenuItemType } from '@univerjs/ui';
import { ToggleRtlCommand } from '../commands/toggle-rtl.command';

@OnLifecycle(LifecycleStages.Ready, RtlUIController)
export class RtlUIController {
    constructor(
        @Inject(Injector) private readonly _injector: Injector,
        @Inject(ICommandService) private readonly _commandService: ICommandService,
        @Inject(IMenuManagerService) private readonly _menuManagerService: IMenuManagerService
    ) {
        this._initCommands();
        this._initMenus();
    }

    private _initCommands(): void {
        this._commandService.registerCommand(ToggleRtlCommand);
    }

    private _initMenus(): void {
        this._menuManagerService.appendMenu({
            id: ToggleRtlCommand.id,
            title: 'RTL Mode',
            tooltip: 'Toggle Right-to-Left Sheet Layout',
            type: MenuItemType.BUTTON,
            positions: ['toolbar'], // Add to toolbar
            // icon: 'AlignRightIcon' // Assuming standard icon exists
        });
    }
}