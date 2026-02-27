import { IAccessor } from '@univerjs/core';
import {
    IMenuButtonItem,
    IMenuManagerService,
    IMenuSelectorItem,
    MenuItemType,
    ContextMenuPosition,
    ContextMenuGroup,
} from '@univerjs/ui';
import { SetTextDirectionCommand } from '../../commands/set-text-direction.command';

// Menu item IDs
export const RTL_CONTEXT_MENU_ID = 'sheet.contextMenu.rtl-text-direction';
export const RTL_CONTEXT_MENU_LTR_ID = 'sheet.contextMenu.rtl-text-direction.ltr';
export const RTL_CONTEXT_MENU_RTL_ID = 'sheet.contextMenu.rtl-text-direction.rtl';
export const RTL_CONTEXT_MENU_AUTO_ID = 'sheet.contextMenu.rtl-text-direction.auto';

/**
 * Factory for "Left to Right" context menu item.
 * Triggers SetTextDirectionCommand with LEFT_TO_RIGHT.
 */
export function RtlContextMenuLtrItemFactory(_accessor: IAccessor): IMenuButtonItem {
    return {
        id: RTL_CONTEXT_MENU_LTR_ID,
        commandId: SetTextDirectionCommand.id,
        type: MenuItemType.BUTTON,
        title: 'Left to Right',
        tooltip: 'Set text direction to Left to Right',
    };
}

/**
 * Factory for "Right to Left" context menu item.
 * Triggers SetTextDirectionCommand with RIGHT_TO_LEFT.
 */
export function RtlContextMenuRtlItemFactory(_accessor: IAccessor): IMenuButtonItem {
    return {
        id: RTL_CONTEXT_MENU_RTL_ID,
        commandId: SetTextDirectionCommand.id,
        type: MenuItemType.BUTTON,
        title: 'Right to Left',
        tooltip: 'Set text direction to Right to Left',
    };
}

/**
 * Factory for "Auto Detect" context menu item.
 * Triggers SetTextDirectionCommand with UNSPECIFIED (auto detect).
 */
export function RtlContextMenuAutoItemFactory(_accessor: IAccessor): IMenuButtonItem {
    return {
        id: RTL_CONTEXT_MENU_AUTO_ID,
        commandId: SetTextDirectionCommand.id,
        type: MenuItemType.BUTTON,
        title: 'Auto Detect',
        tooltip: 'Auto detect text direction',
    };
}

/**
 * Factory for the parent "Text Direction" submenu container.
 */
export function RtlContextMenuParentItemFactory(_accessor: IAccessor): IMenuSelectorItem {
    return {
        id: RTL_CONTEXT_MENU_ID,
        type: MenuItemType.SUBITEMS,
        title: 'Text Direction',
        tooltip: 'Set text direction for selected cells',
    };
}

/**
 * Menu schema for the RTL Text Direction context menu entry.
 * Registered under ContextMenuPosition.MAIN_AREA > ContextMenuGroup.FORMAT.
 */
export const RTL_CONTEXT_MENU_SCHEMA = {
    [ContextMenuPosition.MAIN_AREA]: {
        [ContextMenuGroup.FORMAT]: {
            [RTL_CONTEXT_MENU_ID]: {
                order: 9,
                menuItemFactory: RtlContextMenuParentItemFactory,
                [RTL_CONTEXT_MENU_LTR_ID]: {
                    order: 0,
                    menuItemFactory: RtlContextMenuLtrItemFactory,
                },
                [RTL_CONTEXT_MENU_RTL_ID]: {
                    order: 1,
                    menuItemFactory: RtlContextMenuRtlItemFactory,
                },
                [RTL_CONTEXT_MENU_AUTO_ID]: {
                    order: 2,
                    menuItemFactory: RtlContextMenuAutoItemFactory,
                },
            },
        },
    },
};

/**
 * Register the RTL context menu items with the IMenuManagerService.
 * Call this from the plugin's onStarting lifecycle.
 */
export function registerRtlContextMenu(accessor: IAccessor): void {
    const menuManagerService = accessor.get(IMenuManagerService);
    menuManagerService.mergeMenu(RTL_CONTEXT_MENU_SCHEMA);
}
