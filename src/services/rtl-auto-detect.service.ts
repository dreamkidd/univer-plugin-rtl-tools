import { createIdentifier, Disposable, ICommandService, TextDirection } from '@univerjs/core';
import { Optional } from '@univerjs/core';
import { isRTLDominant, hasRTLCharacters, getRTLPercentage, getFirstStrongDirection } from '../utils/rtl-detector';
import { SetTextDirectionCommand, ISetTextDirectionParams } from '../commands/set-text-direction.command';

export interface IRtlAutoDetectService {
    enabled: boolean;
    threshold: number;
    setEnabled(enabled: boolean): void;
    shouldBeRTL(content: string): boolean;
    getDirection(content: string): 'ltr' | 'rtl' | 'auto';
    detectAndApply(unitId: string, subUnitId: string, row: number, col: number, content: string): void;
    clearCache(): void;
}

export const IRtlAutoDetectService = createIdentifier<IRtlAutoDetectService>('rtl-tools.auto-detect');

const CACHE_SIZE_LIMIT = 1000;

export class RtlAutoDetectService extends Disposable implements IRtlAutoDetectService {
    private _enabled = true;
    private _threshold = 0.5;
    private _cache = new Map<string, boolean>();

    constructor(
        @Optional(ICommandService) private readonly _commandService?: ICommandService
    ) {
        super();
        this.disposeWithMe({
            dispose: () => this.clearCache(),
        });
    }

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        this._enabled = value;
    }

    get threshold(): number {
        return this._threshold;
    }

    set threshold(value: number) {
        if (value !== this._threshold) {
            this._threshold = value;
            // Clear cache when threshold changes since cached results may be invalid
            this.clearCache();
        }
    }

    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
    }

    shouldBeRTL(content: string): boolean {
        if (!this._enabled) return false;
        if (!content) return false;

        if (this._cache.has(content)) {
            return this._cache.get(content)!;
        }

        // Primary strategy: first strong directional character (matches Excel "Context" behavior)
        const firstStrong = getFirstStrongDirection(content);
        let result: boolean;
        if (firstStrong === 'rtl') {
            result = true;
        } else if (firstStrong === 'ltr') {
            result = false;
        } else {
            // Fallback: percentage-based check when no strong directional char found
            result = isRTLDominant(content, this._threshold);
        }

        this._setCache(content, result);
        return result;
    }

    getDirection(content: string): 'ltr' | 'rtl' | 'auto' {
        if (!content || content.trim() === '') return 'auto';
        if (!this._enabled) return 'ltr';

        if (!hasRTLCharacters(content)) return 'ltr';

        const percentage = getRTLPercentage(content);
        if (percentage > this._threshold) return 'rtl';
        if (percentage > 0) return 'auto';
        return 'ltr';
    }

    detectAndApply(_unitId: string, _subUnitId: string, _row: number, _col: number, content: string): void {
        if (!this._enabled || !this._commandService) return;

        const isRtl = this.shouldBeRTL(content);
        const direction = isRtl ? TextDirection.RIGHT_TO_LEFT : TextDirection.LEFT_TO_RIGHT;

        this._commandService.executeCommand<ISetTextDirectionParams>(
            SetTextDirectionCommand.id,
            { direction }
        );
    }

    clearCache(): void {
        this._cache.clear();
    }

    private _setCache(key: string, value: boolean): void {
        if (this._cache.size >= CACHE_SIZE_LIMIT) {
            // Evict the oldest entry (FIFO)
            const firstKey = this._cache.keys().next().value;
            if (firstKey !== undefined) {
                this._cache.delete(firstKey);
            }
        }
        this._cache.set(key, value);
    }
}
