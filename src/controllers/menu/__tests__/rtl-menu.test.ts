import { describe, it, expect } from 'vitest';
import { MenuItemType, RibbonStartGroup } from '@univerjs/ui';
import {
    RtlToggleMenuItemFactory,
    RTL_TOOLBAR_ITEM_ID,
    RTL_MENU_SCHEMA,
} from '../rtl-menu';
import { ToggleRtlCommand } from '../../../commands/toggle-rtl.command';

describe('RtlToggleMenuItemFactory', () => {
    it('returns a BUTTON menu item', () => {
        const item = RtlToggleMenuItemFactory(null as any);
        expect(item.type).toBe(MenuItemType.BUTTON);
    });

    it('uses ToggleRtlCommand id as the menu item id', () => {
        const item = RtlToggleMenuItemFactory(null as any);
        expect(item.id).toBe(ToggleRtlCommand.id);
    });

    it('has an icon defined', () => {
        const item = RtlToggleMenuItemFactory(null as any);
        expect(item.icon).toBeDefined();
        expect(typeof item.icon).toBe('string');
    });

    it('has a title and tooltip', () => {
        const item = RtlToggleMenuItemFactory(null as any);
        expect(item.title).toBeDefined();
        expect(item.tooltip).toBeDefined();
    });
});

describe('RTL_TOOLBAR_ITEM_ID', () => {
    it('matches ToggleRtlCommand.id', () => {
        expect(RTL_TOOLBAR_ITEM_ID).toBe(ToggleRtlCommand.id);
    });
});

describe('RTL_MENU_SCHEMA', () => {
    it('is positioned in the ribbon start layout group', () => {
        expect(RTL_MENU_SCHEMA).toHaveProperty(RibbonStartGroup.LAYOUT);
    });

    it('registers the RTL toolbar item under the layout group', () => {
        const layoutGroup = RTL_MENU_SCHEMA[RibbonStartGroup.LAYOUT];
        expect(layoutGroup).toHaveProperty(RTL_TOOLBAR_ITEM_ID);
    });

    it('menu entry has a menuItemFactory function', () => {
        const layoutGroup = RTL_MENU_SCHEMA[RibbonStartGroup.LAYOUT];
        const entry = layoutGroup[RTL_TOOLBAR_ITEM_ID];
        expect(typeof entry.menuItemFactory).toBe('function');
    });

    it('menu entry has an order number', () => {
        const layoutGroup = RTL_MENU_SCHEMA[RibbonStartGroup.LAYOUT];
        const entry = layoutGroup[RTL_TOOLBAR_ITEM_ID];
        expect(typeof entry.order).toBe('number');
    });
});
