import {
    Inject,
    Injector,
    Plugin,
    registerDependencies,
    touchDependencies,
    UniverInstanceType,
} from '@univerjs/core';
import { ICommandService } from '@univerjs/core';
import { RtlCssController } from './controllers/rtl-css.controller';
import { RtlRenderController } from './controllers/rtl-render.controller';
import { SetTextDirectionCommand } from './commands/set-text-direction.command';
import { IRtlAutoDetectService, RtlAutoDetectService } from './services/rtl-auto-detect.service';

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
        ]);

        const commandService = this._injector.get(ICommandService);
        commandService.registerCommand(SetTextDirectionCommand);
    }

    override onRendered(): void {
        touchDependencies(this._injector, [
            [RtlCssController],
            [RtlRenderController],
        ]);
    }
}
