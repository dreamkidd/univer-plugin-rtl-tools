import { KeyCode, MetaKeys } from '@univerjs/ui';
import type { IShortcutItem } from '@univerjs/ui';
import { SetTextDirectionCommand } from '../commands/set-text-direction.command';

/**
 * Keyboard shortcut for toggling RTL mode: Ctrl+Shift+X
 */
export const ToggleRtlShortcut: IShortcutItem = {
    id: SetTextDirectionCommand.id,
    description: 'Toggle RTL text direction',
    binding: KeyCode.X | MetaKeys.CTRL_COMMAND | MetaKeys.SHIFT,
    group: '10_sheet-view',
};
