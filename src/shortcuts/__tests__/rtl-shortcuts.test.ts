import { describe, it, expect } from 'vitest';
import { KeyCode, MetaKeys } from '@univerjs/ui';
import { ToggleRtlShortcut } from '../rtl-shortcuts';
import { SetTextDirectionCommand } from '../../commands/set-text-direction.command';

describe('ToggleRtlShortcut', () => {
    it('uses SetTextDirectionCommand id', () => {
        expect(ToggleRtlShortcut.id).toBe(SetTextDirectionCommand.id);
    });

    it('has a description', () => {
        expect(typeof ToggleRtlShortcut.description).toBe('string');
        expect(ToggleRtlShortcut.description!.length).toBeGreaterThan(0);
    });

    it('has a key binding defined', () => {
        expect(ToggleRtlShortcut.binding).toBeDefined();
    });

    it('binding includes CTRL_COMMAND modifier', () => {
        expect(ToggleRtlShortcut.binding! & MetaKeys.CTRL_COMMAND).toBeTruthy();
    });

    it('binding includes SHIFT modifier', () => {
        expect(ToggleRtlShortcut.binding! & MetaKeys.SHIFT).toBeTruthy();
    });

    it('binding includes KeyCode.X', () => {
        expect(ToggleRtlShortcut.binding! & KeyCode.X).toBeTruthy();
    });

    it('has a group defined', () => {
        expect(typeof ToggleRtlShortcut.group).toBe('string');
    });
});
