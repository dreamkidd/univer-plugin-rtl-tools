import { describe, it, expect } from 'vitest';
import { MenuItemType, ContextMenuPosition, ContextMenuGroup } from '@univerjs/ui';
import {
    RtlContextMenuLtrItemFactory,
    RtlContextMenuRtlItemFactory,
    RtlContextMenuAutoItemFactory,
    RtlContextMenuParentItemFactory,
    RTL_CONTEXT_MENU_ID,
    RTL_CONTEXT_MENU_LTR_ID,
    RTL_CONTEXT_MENU_RTL_ID,
    RTL_CONTEXT_MENU_AUTO_ID,
    RTL_CONTEXT_MENU_SCHEMA,
} from '../rtl-context-menu';
import { SetTextDirectionCommand } from '../../../commands/set-text-direction.command';

describe('RtlContextMenuLtrItemFactory', () => {
    it('returns a BUTTON item', () => {
        const item = RtlContextMenuLtrItemFactory(null as any);
        expect(item.type).toBe(MenuItemType.BUTTON);
    });

    it('uses RTL_CONTEXT_MENU_LTR_ID as item id', () => {
        const item = RtlContextMenuLtrItemFactory(null as any);
        expect(item.id).toBe(RTL_CONTEXT_MENU_LTR_ID);
    });

    it('references SetTextDirectionCommand', () => {
        const item = RtlContextMenuLtrItemFactory(null as any);
        expect(item.commandId).toBe(SetTextDirectionCommand.id);
    });

    it('has title and tooltip', () => {
        const item = RtlContextMenuLtrItemFactory(null as any);
        expect(item.title).toBeTruthy();
        expect(item.tooltip).toBeTruthy();
    });
});

describe('RtlContextMenuRtlItemFactory', () => {
    it('returns a BUTTON item', () => {
        const item = RtlContextMenuRtlItemFactory(null as any);
        expect(item.type).toBe(MenuItemType.BUTTON);
    });

    it('uses RTL_CONTEXT_MENU_RTL_ID as item id', () => {
        const item = RtlContextMenuRtlItemFactory(null as any);
        expect(item.id).toBe(RTL_CONTEXT_MENU_RTL_ID);
    });

    it('references SetTextDirectionCommand', () => {
        const item = RtlContextMenuRtlItemFactory(null as any);
        expect(item.commandId).toBe(SetTextDirectionCommand.id);
    });

    it('has title and tooltip', () => {
        const item = RtlContextMenuRtlItemFactory(null as any);
        expect(item.title).toBeTruthy();
        expect(item.tooltip).toBeTruthy();
    });
});

describe('RtlContextMenuAutoItemFactory', () => {
    it('returns a BUTTON item', () => {
        const item = RtlContextMenuAutoItemFactory(null as any);
        expect(item.type).toBe(MenuItemType.BUTTON);
    });

    it('uses RTL_CONTEXT_MENU_AUTO_ID as item id', () => {
        const item = RtlContextMenuAutoItemFactory(null as any);
        expect(item.id).toBe(RTL_CONTEXT_MENU_AUTO_ID);
    });
});

describe('RtlContextMenuParentItemFactory', () => {
    it('returns a SUBITEMS item', () => {
        const item = RtlContextMenuParentItemFactory(null as any);
        expect(item.type).toBe(MenuItemType.SUBITEMS);
    });

    it('uses RTL_CONTEXT_MENU_ID as item id', () => {
        const item = RtlContextMenuParentItemFactory(null as any);
        expect(item.id).toBe(RTL_CONTEXT_MENU_ID);
    });

    it('has title and tooltip', () => {
        const item = RtlContextMenuParentItemFactory(null as any);
        expect(item.title).toBeTruthy();
        expect(item.tooltip).toBeTruthy();
    });
});

describe('RTL_CONTEXT_MENU_SCHEMA', () => {
    it('registers under MAIN_AREA context menu position', () => {
        expect(RTL_CONTEXT_MENU_SCHEMA).toHaveProperty(ContextMenuPosition.MAIN_AREA);
    });

    it('registers under FORMAT context menu group', () => {
        const mainArea = RTL_CONTEXT_MENU_SCHEMA[ContextMenuPosition.MAIN_AREA];
        expect(mainArea).toHaveProperty(ContextMenuGroup.FORMAT);
    });

    it('registers the parent RTL menu item', () => {
        const formatGroup = RTL_CONTEXT_MENU_SCHEMA[ContextMenuPosition.MAIN_AREA][ContextMenuGroup.FORMAT];
        expect(formatGroup).toHaveProperty(RTL_CONTEXT_MENU_ID);
    });

    it('parent entry has a menuItemFactory and order', () => {
        const entry = RTL_CONTEXT_MENU_SCHEMA[ContextMenuPosition.MAIN_AREA][ContextMenuGroup.FORMAT][RTL_CONTEXT_MENU_ID];
        expect(typeof entry.menuItemFactory).toBe('function');
        expect(typeof entry.order).toBe('number');
    });

    it('registers LTR sub-item', () => {
        const entry = RTL_CONTEXT_MENU_SCHEMA[ContextMenuPosition.MAIN_AREA][ContextMenuGroup.FORMAT][RTL_CONTEXT_MENU_ID];
        expect(entry).toHaveProperty(RTL_CONTEXT_MENU_LTR_ID);
    });

    it('registers RTL sub-item', () => {
        const entry = RTL_CONTEXT_MENU_SCHEMA[ContextMenuPosition.MAIN_AREA][ContextMenuGroup.FORMAT][RTL_CONTEXT_MENU_ID];
        expect(entry).toHaveProperty(RTL_CONTEXT_MENU_RTL_ID);
    });

    it('registers Auto sub-item', () => {
        const entry = RTL_CONTEXT_MENU_SCHEMA[ContextMenuPosition.MAIN_AREA][ContextMenuGroup.FORMAT][RTL_CONTEXT_MENU_ID];
        expect(entry).toHaveProperty(RTL_CONTEXT_MENU_AUTO_ID);
    });
});
