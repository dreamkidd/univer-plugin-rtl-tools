import { CommandType, ICommand, ICommandService } from '@univerjs/core';
import { IUniverInstanceService } from '@univerjs/core';

export const ToggleRtlCommand: ICommand = {
    id: 'sheet.command.toggle-rtl',
    type: CommandType.COMMAND,
    handler: async (accessor) => {
        const univerInstanceService = accessor.get(IUniverInstanceService);
        const commandService = accessor.get(ICommandService);
        
        const workbook = univerInstanceService.getCurrentUnitForType(0); // 0 is Sheet
        if (!workbook) return false;

        const worksheet = workbook.getActiveSheet();
        
        // NOTE: This assumes the core engine has exposed a `setDirection` or similar property.
        // If not, this is where we would trigger the state change that the UI reacts to.
        console.log(`[RtlToolsPlugin] Toggling RTL for sheet: ${worksheet.getSheetId()}`);
        
        // Mocking the mutation call that would update the core state
        // return commandService.executeCommand(SetSheetDirectionMutation.id, { direction: 'rtl' });
        
        alert("RTL Toggle Command Executed! (Awaiting core engine support)");
        
        return true;
    },
};