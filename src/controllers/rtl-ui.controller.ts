import { Disposable, Inject } from '@univerjs/core';
import { ICommandService } from '@univerjs/core';
import { ToggleRtlCommand } from '../commands/toggle-rtl.command';
import { isRTLDominant } from '../utils/rtl-detector';

export class RtlUIController extends Disposable {
    constructor(
        @Inject(ICommandService) private readonly _commandService: ICommandService
    ) {
        super();
        this._initCommands();
        this._initListeners();
    }

    private _initCommands(): void {
        this.disposeWithMe(
            this._commandService.registerCommand(ToggleRtlCommand)
        );
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
