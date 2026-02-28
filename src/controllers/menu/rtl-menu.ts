import { IAccessor } from '@univerjs/core';
import { IMenuButtonItem, MenuItemType, RibbonStartGroup } from '@univerjs/ui';
import { SetTextDirectionCommand } from '../../commands/set-text-direction.command';

export const RTL_TOOLBAR_ITEM_ID = SetTextDirectionCommand.id;

/**
 * Menu item factory for the RTL toggle toolbar button.
 * Registers a button in the ribbon toolbar under the Layout group.
 */
export function RtlToggleMenuItemFactory(_accessor: IAccessor): IMenuButtonItem {
    return {
        id: RTL_TOOLBAR_ITEM_ID,
        type: MenuItemType.BUTTON,
        icon: 'RtlIcon',
        title: 'Toggle RTL',
        tooltip: 'rtl-tools.toolbar.toggle-rtl',
    };
}

/**
 * Menu schema for the RTL toggle button, positioned in the ribbon start tab layout group.
 */
export const RTL_MENU_SCHEMA = {
    [RibbonStartGroup.LAYOUT]: {
        [RTL_TOOLBAR_ITEM_ID]: {
            order: 100,
            menuItemFactory: RtlToggleMenuItemFactory,
        },
    },
};
