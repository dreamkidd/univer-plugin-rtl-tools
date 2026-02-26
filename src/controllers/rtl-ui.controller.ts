import { Inject, Injector, LifecycleStages, OnLifecycle } from '@univerjs/core';
import { ICommandService, IUniverInstanceService } from '@univerjs/core';
import { IMenuManagerService, MenuItemType } from '@univerjs/ui';
import { ToggleRtlCommand } from '../commands/toggle-rtl.command';
import { isRTLDominant } from '../utils/rtl-detector';

@OnLifecycle(LifecycleStages.Ready, RtlUIController)
export class RtlUIController {
    constructor(
        @Inject(Injector) private readonly _injector: Injector,
        @Inject(ICommandService) private readonly _commandService: ICommandService,
        @Inject(IMenuManagerService) private readonly _menuManagerService: IMenuManagerService,
        @Inject(IUniverInstanceService) private readonly _univerInstanceService: IUniverInstanceService
    ) {
        this._initCommands();
        this._initMenus();
        this._initListeners();
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
        });
    }

    private _initListeners(): void {
        // Listen to cell content changes to detect RTL text
        // Note: In a real Univer plugin, you would listen to `CommandService.onCommandExecuted` 
        // for `SetRangeValuesMutation` to inspect newly typed cell values.
        
        this._commandService.onCommandExecuted((commandInfo) => {
            // Pseudo-code for detecting cell edits:
            if (commandInfo.id === 'sheet.mutation.set-range-values') {
                const params = commandInfo.params as any;
                
                // Assuming params contains the new cell value
                // const newCellValue = params.cellValue...
                const mockTypedText = "مرحبا بالعالم"; // Example Arabic text

                if (isRTLDominant(mockTypedText)) {
                    console.log("[RtlToolsPlugin] Detected RTL language input! Prompting user...");
                    // Here you could trigger a notification or automatically toggle the UI direction
                    // alert("RTL text detected! Consider switching to RTL mode.");
                }
            }
        });
    }
}