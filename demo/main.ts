import { LocaleType, Univer, UniverInstanceType, Tools } from '@univerjs/core';
import { defaultTheme } from '@univerjs/design';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverUIPlugin } from '@univerjs/ui';

// CSS imports (order matters)
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';

// Locale imports
import DesignEnUS from '@univerjs/design/locale/en-US';
import UIEnUS from '@univerjs/ui/locale/en-US';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';

// Import the RTL plugin from parent project source
import { UniverRtlToolsPlugin } from '../src';

// Initialize Univer
const univer = new Univer({
    theme: defaultTheme,
    locale: LocaleType.EN_US,
    locales: {
        [LocaleType.EN_US]: Tools.deepMerge(
            {} as any,
            DesignEnUS,
            UIEnUS,
            DocsUIEnUS,
            SheetsEnUS,
            SheetsUIEnUS,
        ),
    },
});

// Register core plugins
univer.registerPlugin(UniverRenderEnginePlugin);
univer.registerPlugin(UniverFormulaEnginePlugin);
univer.registerPlugin(UniverUIPlugin, { container: 'app' });
univer.registerPlugin(UniverDocsPlugin);
univer.registerPlugin(UniverDocsUIPlugin);
univer.registerPlugin(UniverSheetsPlugin);
univer.registerPlugin(UniverSheetsUIPlugin);

// Register RTL plugin
univer.registerPlugin(UniverRtlToolsPlugin);

// Create workbook with RTL test data
univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
    id: 'rtl-demo',
    name: 'RTL Demo',
    appVersion: '0.4.2',
    locale: LocaleType.EN_US,
    styles: {},
    sheetOrder: ['sheet-01'],
    sheets: {
        'sheet-01': {
            id: 'sheet-01',
            name: 'RTL Test',
            rowCount: 100,
            columnCount: 26,
            defaultColumnWidth: 200,
            cellData: {
                // Row 0: Headers
                0: {
                    0: { v: 'Type' },
                    1: { v: 'Content' },
                    2: { v: 'Expected' },
                },
                // Row 1: Pure Arabic
                1: {
                    0: { v: 'Arabic' },
                    1: { v: 'مرحبا بالعالم' },
                    2: { v: 'RTL - right aligned' },
                },
                // Row 2: Pure Hebrew
                2: {
                    0: { v: 'Hebrew' },
                    1: { v: 'שלום עולם' },
                    2: { v: 'RTL - right aligned' },
                },
                // Row 3: Pure English
                3: {
                    0: { v: 'English' },
                    1: { v: 'Hello World' },
                    2: { v: 'LTR - left aligned' },
                },
                // Row 4: Mixed (Arabic first)
                4: {
                    0: { v: 'Mixed (AR first)' },
                    1: { v: 'مرحبا Hello World' },
                    2: { v: 'RTL - first strong is Arabic' },
                },
                // Row 5: Mixed (English first)
                5: {
                    0: { v: 'Mixed (EN first)' },
                    1: { v: 'Hello مرحبا World' },
                    2: { v: 'LTR - first strong is Latin' },
                },
                // Row 6: Numbers + Arabic
                6: {
                    0: { v: 'Num + Arabic' },
                    1: { v: '123 مرحبا' },
                    2: { v: 'RTL - numbers neutral' },
                },
                // Row 7: Pure numbers
                7: {
                    0: { v: 'Numbers' },
                    1: { v: '1234567890' },
                    2: { v: 'LTR - no strong chars' },
                },
                // Row 8: Arabic with date
                8: {
                    0: { v: 'Arabic + date' },
                    1: { v: 'مرحبا 2024-01-15' },
                    2: { v: 'RTL - first strong is Arabic' },
                },
                // Row 9: separator
                9: {
                    0: { v: '--- Manual Test Area ---' },
                },
                // Row 10+: for manual input
                10: { 0: { v: 'Type Arabic here →' } },
                11: { 0: { v: 'Type English here →' } },
                12: { 0: { v: 'Type mixed here →' } },
            },
        },
    },
});

console.log('[RTL Demo] Ready! Test:');
console.log('1. B2-B3 (Arabic/Hebrew) should auto-detect as RTL');
console.log('2. Right-click → "Text Direction" submenu');
console.log('3. Ctrl+Shift+X toggles direction');
console.log('4. Type Arabic in B11, press Enter → auto RTL');
console.log('5. Check console for [RtlToolsPlugin] logs');
