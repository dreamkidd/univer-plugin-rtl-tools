import { CommandType, ICommand, IUniverInstanceService } from '@univerjs/core';
import { RtlCssController } from '../controllers/rtl-css.controller';

export const ToggleRtlCommand: ICommand = {
    id: 'sheet.command.toggle-rtl',
    type: CommandType.COMMAND,
    handler: async (accessor) => {
        const univerInstanceService = accessor.get(IUniverInstanceService);
        const rtlCssController = accessor.get(RtlCssController);

        const workbook = univerInstanceService.getCurrentUnitForType(0); // 0 is Sheet
        if (!workbook) return false;

        rtlCssController.toggle();

        const worksheet = workbook.getActiveSheet();
        const enabled = rtlCssController.isEnabled;
        console.log(`[RtlToolsPlugin] RTL mode ${enabled ? 'enabled' : 'disabled'} for sheet: ${worksheet.getSheetId()}`);

        return true;
    },
};