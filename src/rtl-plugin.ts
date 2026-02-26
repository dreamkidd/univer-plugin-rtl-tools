import { Plugin, PluginType, Inject, Injector } from '@univerjs/core';
import { RtlUIController } from './controllers/rtl-ui.controller';
import { ToggleRtlCommand } from './commands/toggle-rtl.command';

export class UniverRtlToolsPlugin extends Plugin {
    static override type = PluginType.Sheet;
    static override pluginName = 'SHEET_RTL_TOOLS_PLUGIN';

    constructor(
        _config: any,
        @Inject(Injector) override readonly _injector: Injector
    ) {
        super(UniverRtlToolsPlugin.pluginName);
    }

    override onStarting(): void {
        const dependencies: [any][] = [
            [RtlUIController],
        ];

        dependencies.forEach((d) => this._injector.add(d));
    }

    override onReady(): void {
        this._injector.get(RtlUIController);
    }
}