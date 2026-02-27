import {
    Inject,
    Injector,
    Plugin,
    registerDependencies,
    touchDependencies,
    UniverInstanceType,
} from '@univerjs/core';
import { ICommandService } from '@univerjs/core';
import { IShortcutService } from '@univerjs/ui';
import { RtlCssController } from './controllers/rtl-css.controller';
import { RtlRenderController } from './controllers/rtl-render.controller';
import { RtlStatusController } from './controllers/rtl-status.controller';
import { SetTextDirectionCommand } from './commands/set-text-direction.command';
import { IRtlAutoDetectService, RtlAutoDetectService } from './services/rtl-auto-detect.service';
import { ToggleRtlCommand } from './commands/toggle-rtl.command';
import { ToggleRtlShortcut } from './shortcuts/rtl-shortcuts';
import { registerRtlContextMenu } from './controllers/menu/rtl-context-menu';

export class UniverRtlToolsPlugin extends Plugin {
    static override type = UniverInstanceType.UNIVER_SHEET;
    static override pluginName = 'SHEET_RTL_TOOLS_PLUGIN';

    constructor(
        _config: unknown,
        @Inject(Injector) override readonly _injector: Injector
    ) {
        super();
    }

    override onStarting(): void {
        registerDependencies(this._injector, [
            [IRtlAutoDetectService, { useClass: RtlAutoDetectService }],
            [RtlCssController],
            [RtlRenderController],
            [RtlStatusController],
        ]);

        const commandService = this._injector.get(ICommandService);
        commandService.registerCommand(SetTextDirectionCommand);
        commandService.registerCommand(ToggleRtlCommand);

        const shortcutService = this._injector.get(IShortcutService);
        shortcutService.registerShortcut(ToggleRtlShortcut);

        // Register context menu items for Text Direction
        registerRtlContextMenu(this._injector);
    }

    override onRendered(): void {
        touchDependencies(this._injector, [
            [RtlCssController],
            [RtlRenderController],
            [RtlStatusController],
        ]);
    }
}
