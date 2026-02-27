import { CommandType, ICommand, IAccessor, IUniverInstanceService, ICommandService, TextDirection } from '@univerjs/core';

export interface ISetTextDirectionParams {
    direction: TextDirection;
}

export const SetTextDirectionCommand: ICommand<ISetTextDirectionParams> = {
    id: 'sheet.command.set-text-direction',
    type: CommandType.COMMAND,
    handler: async (accessor: IAccessor, params?: ISetTextDirectionParams) => {
        if (!params) return false;

        const univerInstanceService = accessor.get(IUniverInstanceService);
        const commandService = accessor.get(ICommandService);

        // Get current workbook
        const workbook = univerInstanceService.getCurrentUnitForType(0); // 0 = UniverInstanceType.UNIVER_SHEET
        if (!workbook) return false;

        const worksheet = (workbook as any).getActiveSheet?.();
        if (!worksheet) return false;

        // Build the style mutation params with td (textDirection) property
        const styleMutation = {
            td: params.direction,
        };

        // Execute SetRangeValuesCommand or equivalent to apply style to current selection.
        // Since @univerjs/sheets is not bundled in this plugin, we dispatch the mutation
        // through the known command id used by Univer sheets for setting cell styles.
        const result = await commandService.executeCommand(
            'sheet.command.set-range-values',
            {
                value: {
                    s: styleMutation,
                },
            }
        );

        console.log(
            `[RtlToolsPlugin] Set text direction to ${params.direction === TextDirection.RIGHT_TO_LEFT ? 'RTL' : 'LTR'} on active selection`
        );

        return result;
    },
};
