// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RtlStatusIndicator } from '../rtl-status-indicator';
describe('RtlStatusIndicator', () => {
    let onClick: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onClick = vi.fn();
        // Clean up any existing indicator elements
        const existing = document.getElementById('univer-rtl-status-indicator');
        if (existing) existing.remove();
    });

    describe('createElement()', () => {
        it('creates a span element', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            const el = indicator.createElement();
            expect(el.tagName.toLowerCase()).toBe('span');
        });

        it('sets the element id', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            const el = indicator.createElement();
            expect(el.id).toBe('univer-rtl-status-indicator');
        });

        it('shows "LTR" text when disabled', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            const el = indicator.createElement();
            expect(el.textContent).toBe('LTR');
        });

        it('shows "RTL" text when enabled', () => {
            const indicator = new RtlStatusIndicator({ enabled: true, onClick });
            const el = indicator.createElement();
            expect(el.textContent).toBe('RTL');
        });

        it('is idempotent — returns same element on repeated calls', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            const el1 = indicator.createElement();
            const el2 = indicator.createElement();
            expect(el1).toBe(el2);
        });

        it('has a title attribute for accessibility', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            const el = indicator.createElement();
            expect(el.title).toBeTruthy();
        });
    });

    describe('update()', () => {
        it('switches from LTR to RTL', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            const el = indicator.createElement();
            expect(el.textContent).toBe('LTR');
            indicator.update(true);
            expect(el.textContent).toBe('RTL');
        });

        it('switches from RTL to LTR', () => {
            const indicator = new RtlStatusIndicator({ enabled: true, onClick });
            const el = indicator.createElement();
            expect(el.textContent).toBe('RTL');
            indicator.update(false);
            expect(el.textContent).toBe('LTR');
        });

        it('does not throw when called before createElement()', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            expect(() => indicator.update(true)).not.toThrow();
        });
    });

    describe('click handling', () => {
        it('calls onClick when element is clicked', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            const el = indicator.createElement();
            el.click();
            expect(onClick).toHaveBeenCalledOnce();
        });

        it('calls onClick multiple times on multiple clicks', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            const el = indicator.createElement();
            el.click();
            el.click();
            el.click();
            expect(onClick).toHaveBeenCalledTimes(3);
        });
    });

    describe('destroy()', () => {
        it('removes the element from the DOM', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            const el = indicator.createElement();
            document.body.appendChild(el);
            expect(document.getElementById('univer-rtl-status-indicator')).toBeTruthy();
            indicator.destroy();
            expect(document.getElementById('univer-rtl-status-indicator')).toBeNull();
        });

        it('is safe to call multiple times', () => {
            const indicator = new RtlStatusIndicator({ enabled: false, onClick });
            indicator.createElement();
            expect(() => {
                indicator.destroy();
                indicator.destroy();
            }).not.toThrow();
        });
    });
});
