import { describe, it, expect } from 'vitest';
import { CommandType } from '@univerjs/core';
import { SetTextDirectionCommand } from '../set-text-direction.command';

describe('SetTextDirectionCommand', () => {
    it('has the correct command ID', () => {
        expect(SetTextDirectionCommand.id).toBe('sheet.command.set-text-direction');
    });

    it('has command type COMMAND', () => {
        expect(SetTextDirectionCommand.type).toBe(CommandType.COMMAND);
    });

    it('has a handler function', () => {
        expect(typeof SetTextDirectionCommand.handler).toBe('function');
    });
});
