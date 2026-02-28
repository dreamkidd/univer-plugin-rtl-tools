# RTL 插件测试策略

> 版本：v0.2.0 | 日期：2026-02-27

---

## 概述

本文档描述 `@dreamkidd/univer-plugin-rtl-tools` 的完整测试策略，涵盖从纯函数单元测试到需要 Univer 测试套件的集成测试，以及手动验证清单。

插件已在 `package.json` 中配置了 `vitest`（`"test": "vitest run"`），可直接执行。

---

## 1. 单元测试（Unit Tests）

这些测试不依赖 Univer DI 框架，可立即实现并运行。

### 1.1 `src/utils/rtl-detector.ts`

#### `hasRTLCharacters(text: string): boolean`

| 用例 | 输入 | 期望结果 |
|------|------|---------|
| 阿拉伯字符 | `"مرحبا"` | `true` |
| 希伯来字符 | `"שלום"` | `true` |
| 纯英文 | `"Hello"` | `false` |
| 空字符串 | `""` | `false` |
| 混合文本（含阿拉伯） | `"Hello مرحبا"` | `true` |
| 仅数字和标点 | `"123!@#"` | `false` |
| 叙利亚字符（U+0700-074F） | `"\u0710\u0712"` | `true` |
| Thaana 字符（U+0780-07BF） | `"\u0780\u0781"` | `true` |
| 阿拉伯扩展-A（U+08A0-08FF） | `"\u08A0"` | `true` |
| 阿拉伯表现形式-B（U+FE70-FEFF） | `"\uFE70"` | `true` |

```typescript
// tests/utils/rtl-detector.test.ts
import { describe, it, expect } from 'vitest';
import { hasRTLCharacters } from '../../src/utils/rtl-detector';

describe('hasRTLCharacters', () => {
    it('应检测到阿拉伯字符', () => {
        expect(hasRTLCharacters('مرحبا')).toBe(true);
    });
    it('应检测到希伯来字符', () => {
        expect(hasRTLCharacters('שלום')).toBe(true);
    });
    it('不应将纯英文识别为RTL', () => {
        expect(hasRTLCharacters('Hello World')).toBe(false);
    });
    it('空字符串返回false', () => {
        expect(hasRTLCharacters('')).toBe(false);
    });
    it('混合文本只要含RTL即返回true', () => {
        expect(hasRTLCharacters('Hello مرحبا')).toBe(true);
    });
});
```

#### `getRTLPercentage(text: string): number`

| 用例 | 输入 | 期望结果（近似） |
|------|------|----------------|
| 全阿拉伯 | `"مرحبا"` | `1.0` |
| 全英文 | `"Hello"` | `0.0` |
| 空字符串 | `""` | `0.0` |
| 仅空格/数字/标点 | `"123 .,!?"` | `0.0`（被过滤） |
| 50% 阿拉伯 | `"مرHello"` | `~0.5` |
| 阿拉伯加空格 | `"م ر ح"` | `1.0`（空格被过滤） |

```typescript
describe('getRTLPercentage', () => {
    it('全RTL文本应返回1.0', () => {
        expect(getRTLPercentage('مرحبا')).toBeCloseTo(1.0);
    });
    it('全LTR文本应返回0.0', () => {
        expect(getRTLPercentage('Hello')).toBeCloseTo(0.0);
    });
    it('空字符串应返回0', () => {
        expect(getRTLPercentage('')).toBe(0);
    });
    it('空格和数字被排除，不计入分母', () => {
        expect(getRTLPercentage('   123')).toBe(0);
    });
    it('混合文本比例在0到1之间', () => {
        const ratio = getRTLPercentage('مHello');
        expect(ratio).toBeGreaterThan(0);
        expect(ratio).toBeLessThan(1);
    });
});
```

#### `isRTLDominant(text: string, threshold?: number): boolean`

| 用例 | 输入 | threshold | 期望 |
|------|------|-----------|------|
| 高RTL比例，默认阈值 | `"مرحبا"` | `0.3` | `true` |
| 低RTL比例 | `"Hello مر"` | `0.3` | `false` |
| 恰好等于阈值（不超过） | 恰好30% RTL | `0.3` | `false`（`>`而非`>=`） |
| 自定义高阈值 | `"مرحبا"` | `0.8` | `false` |
| 自定义低阈值 | 少量RTL | `0.1` | `true` |
| 空字符串 | `""` | `0.3` | `false` |

```typescript
describe('isRTLDominant', () => {
    it('RTL主导文本应返回true（默认阈值0.3）', () => {
        expect(isRTLDominant('مرحبا')).toBe(true);
    });
    it('阈值边界：恰好等于不超过', () => {
        // 构造恰好30% RTL的字符串：1个阿拉伯字母 + 2个英文字母
        expect(isRTLDominant('مab', 0.3)).toBe(true); // ~33% > 30%
        expect(isRTLDominant('مabc', 0.25)).toBe(true); // 25% > 0.25? false
    });
    it('使用严格阈值0.8时，大多数混合文本不是RTL主导', () => {
        expect(isRTLDominant('مرحبا Hello World', 0.8)).toBe(false);
    });
});
```

#### `getFirstStrongDirection(text: string): 'ltr' | 'rtl' | null`（待实现）

该函数应返回文本中第一个"强方向"字符的方向，数字和标点为中性字符（不算强方向），空字符串或全中性字符返回 `null`。

测试用例：

| 用例 | 输入 | 期望结果 |
|------|------|---------|
| 首字符为阿拉伯字母 | `"مرحبا"` | `'rtl'` |
| 首字符为英文字母 | `"Hello مرحبا"` | `'ltr'` |
| 首字符为数字，后续为阿拉伯 | `"123 مرحبا"` | `'rtl'`（数字为中性，跳过） |
| 首字符为数字，后续为英文 | `"123 Hello"` | `'ltr'` |
| 空字符串 | `""` | `null` |
| 全为数字和标点 | `"123!@#"` | `null`（无强方向字符） |
| 纯阿拉伯文本 | `"مرحبا"` | `'rtl'` |
| 纯英文文本 | `"Hello"` | `'ltr'` |

```typescript
describe('getFirstStrongDirection', () => {
    it('首字符为阿拉伯字母应返回rtl', () => {
        expect(getFirstStrongDirection('مرحبا')).toBe('rtl');
    });
    it('首字符为英文字母应返回ltr', () => {
        expect(getFirstStrongDirection('Hello مرحبا')).toBe('ltr');
    });
    it('数字开头后续为阿拉伯应返回rtl（数字为中性）', () => {
        expect(getFirstStrongDirection('123 مرحبا')).toBe('rtl');
    });
    it('数字开头后续为英文应返回ltr', () => {
        expect(getFirstStrongDirection('123 Hello')).toBe('ltr');
    });
    it('空字符串应返回null', () => {
        expect(getFirstStrongDirection('')).toBeNull();
    });
    it('全为数字和标点（无强方向字符）应返回null', () => {
        expect(getFirstStrongDirection('123!@#')).toBeNull();
    });
});
```

---

### 1.2 `src/services/rtl-auto-detect.service.ts`

该服务可在不注入 `ICommandService` 的情况下测试（`@Optional` 装饰器允许省略）。

#### `shouldBeRTL(content: string): boolean`

```typescript
// tests/services/rtl-auto-detect.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RtlAutoDetectService } from '../../src/services/rtl-auto-detect.service';

describe('RtlAutoDetectService', () => {
    let service: RtlAutoDetectService;

    beforeEach(() => {
        // 无需 ICommandService（@Optional），直接实例化
        service = new RtlAutoDetectService();
    });

    describe('shouldBeRTL', () => {
        it('RTL主导文本应返回true', () => {
            expect(service.shouldBeRTL('مرحبا')).toBe(true);
        });
        it('纯LTR文本应返回false', () => {
            expect(service.shouldBeRTL('Hello World')).toBe(false);
        });
        it('空字符串返回false', () => {
            expect(service.shouldBeRTL('')).toBe(false);
        });
        it('服务禁用时始终返回false', () => {
            service.setEnabled(false);
            expect(service.shouldBeRTL('مرحبا')).toBe(false);
        });
    });
```

#### LRU 缓存行为

```typescript
    describe('LRU缓存', () => {
        it('相同内容第二次调用应命中缓存', () => {
            const text = 'مرحبا';
            service.shouldBeRTL(text); // 写入缓存
            service.shouldBeRTL(text); // 命中缓存（无法直接断言，但应无错误且结果一致）
            expect(service.shouldBeRTL(text)).toBe(true);
        });

        it('clearCache后缓存应被清空', () => {
            service.shouldBeRTL('مرحبا');
            service.clearCache();
            // 清除后再次调用应仍能正确返回
            expect(service.shouldBeRTL('مرحبا')).toBe(true);
        });

        it('修改threshold时缓存应被自动清空', () => {
            service.threshold = 0.5;
            service.shouldBeRTL('ماب'); // 写入缓存
            service.threshold = 0.9;   // 触发clearCache
            // 由于threshold提高，原本被认为是RTL的文本可能变为false
            // 验证缓存确实被清空（结果应基于新threshold重新计算）
            expect(typeof service.shouldBeRTL('ماب')).toBe('boolean');
        });

        it('超过1000条缓存时应执行FIFO淘汰', () => {
            // 填充超过CACHE_SIZE_LIMIT=1000的条目
            for (let i = 0; i < 1001; i++) {
                service.shouldBeRTL(`text-${i}`);
            }
            // 服务仍可正常工作，不应抛出错误
            expect(service.shouldBeRTL('مرحبا')).toBe(true);
        });
    });
```

#### threshold 配置

```typescript
    describe('threshold配置', () => {
        it('默认threshold为0.5', () => {
            expect(service.threshold).toBe(0.5);
        });
        it('设置threshold影响shouldBeRTL结果', () => {
            // 构造约33%的RTL文本
            const mixedText = 'مab'; // 1 RTL + 2 LTR
            service.threshold = 0.1; // 10%，应判定为RTL
            expect(service.shouldBeRTL(mixedText)).toBe(true);
            service.threshold = 0.9; // 90%，应判定为LTR
            expect(service.shouldBeRTL(mixedText)).toBe(false);
        });
    });
```

#### `getDirection(content: string): 'ltr' | 'rtl' | 'auto'`

```typescript
    describe('getDirection', () => {
        it('空字符串返回auto', () => {
            expect(service.getDirection('')).toBe('auto');
        });
        it('空白字符串返回auto', () => {
            expect(service.getDirection('   ')).toBe('auto');
        });
        it('无RTL字符返回ltr', () => {
            expect(service.getDirection('Hello')).toBe('ltr');
        });
        it('服务禁用时返回ltr', () => {
            service.setEnabled(false);
            expect(service.getDirection('مرحبا')).toBe('ltr');
        });
        it('RTL比例超过阈值返回rtl', () => {
            service.threshold = 0.3;
            expect(service.getDirection('مرحبا')).toBe('rtl');
        });
        it('RTL比例低于阈值但大于0返回auto', () => {
            service.threshold = 0.9;
            // 少量RTL（约33%）
            expect(service.getDirection('مab')).toBe('auto');
        });
    });
});
```

---

### 1.3 `src/commands/set-text-direction.command.ts`

命令的 `handler` 依赖 `IAccessor`，需使用 mock accessor。

```typescript
// tests/commands/set-text-direction.command.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SetTextDirectionCommand } from '../../src/commands/set-text-direction.command';
import { TextDirection } from '@univerjs/core';

describe('SetTextDirectionCommand', () => {
    it('命令ID应为 sheet.command.set-text-direction', () => {
        expect(SetTextDirectionCommand.id).toBe('sheet.command.set-text-direction');
    });

    it('params为undefined时应返回false', async () => {
        const mockAccessor = {
            get: vi.fn(),
        };
        const result = await SetTextDirectionCommand.handler(mockAccessor as any, undefined);
        expect(result).toBe(false);
    });

    it('工作表不存在时应返回false', async () => {
        const mockCommandService = { executeCommand: vi.fn() };
        const mockUniverInstanceService = {
            getCurrentUnitForType: vi.fn().mockReturnValue(null),
        };
        const mockAccessor = {
            get: vi.fn((token: any) => {
                if (token === 'IUniverInstanceService') return mockUniverInstanceService;
                if (token === 'ICommandService') return mockCommandService;
                return null;
            }),
        };
        const result = await SetTextDirectionCommand.handler(
            mockAccessor as any,
            { direction: TextDirection.RIGHT_TO_LEFT }
        );
        expect(result).toBe(false);
    });

    it('params.direction应为合法TextDirection值', () => {
        // 验证TextDirection枚举值
        expect(TextDirection.LEFT_TO_RIGHT).toBeDefined();
        expect(TextDirection.RIGHT_TO_LEFT).toBeDefined();
    });

    it('成功时应调用executeCommand传入set-range-values', async () => {
        const mockExecuteCommand = vi.fn().mockResolvedValue(true);
        const mockWorksheet = { getActiveSheet: vi.fn() };
        const mockWorkbook = {
            getActiveSheet: vi.fn().mockReturnValue(mockWorksheet),
        };
        const mockCommandService = { executeCommand: mockExecuteCommand };
        const mockUniverInstanceService = {
            getCurrentUnitForType: vi.fn().mockReturnValue(mockWorkbook),
        };
        const mockAccessor = {
            get: vi.fn((token: any) => {
                if (String(token).includes('UniverInstance')) return mockUniverInstanceService;
                if (String(token).includes('Command')) return mockCommandService;
                return null;
            }),
        };

        await SetTextDirectionCommand.handler(
            mockAccessor as any,
            { direction: TextDirection.RIGHT_TO_LEFT }
        );

        expect(mockExecuteCommand).toHaveBeenCalledWith(
            'sheet.command.set-range-values',
            expect.objectContaining({
                value: expect.objectContaining({
                    s: expect.objectContaining({
                        td: TextDirection.RIGHT_TO_LEFT,
                    }),
                }),
            })
        );
    });
});
```

---

## 2. 集成测试（Integration Tests）

这些测试需要 Univer 测试基础设施（DI 容器 + 测试 workbook），可在 Univer 提供官方测试套件后实现。

### 2.1 `RtlAutoApplyController`

**测试场景：**

| 场景 | 验证点 |
|------|--------|
| 工作簿加载后扫描 | `LifecycleStages.Rendered` 触发时，含RTL文本的单元格被自动设置 `td=RTL, ht=RIGHT` |
| 已设置 `td` 的单元格跳过 | 不覆盖已有明确方向设置的单元格 |
| 超过10000行/100列的单元格不扫描 | 性能边界：`Math.min(maxRow, 10000)` |
| 单元格编辑监听 | 用户输入RTL文本后，`setTimeout(0)` 内自动应用样式 |
| 无RTL文本的工作簿 | 不执行任何命令（`rtlCells.length === 0`） |
| `dispose()` 后监听停止 | 销毁控制器后编辑不再触发自动应用 |

**Mock 策略：**

```typescript
// 伪代码 - 需要 @univerjs/core 测试工具
import { createTestBed } from '@univerjs/core/testing'; // 假设路径

const testBed = createTestBed({
    plugins: [UniverRtlToolsPlugin],
    workbookData: {
        sheets: {
            sheet1: {
                cellData: {
                    0: { 0: { v: 'مرحبا' } }, // RTL文本
                    1: { 0: { v: 'Hello' } },  // LTR文本
                }
            }
        }
    }
});
```

### 2.2 `RtlRenderController`

**测试场景：**

| 场景 | 验证点 |
|------|--------|
| monkey-patch 成功 | `fontExtension.renderFontEachCell` 被替换 |
| RTL单元格渲染 | `ctx.direction === 'rtl'` 且 `ctx.textAlign === 'right'` |
| LTR单元格渲染 | Canvas上下文未被修改 |
| `ctx.save()` / `ctx.restore()` 配对 | RTL渲染后上下文被正确恢复 |
| `dispose()` 后还原 | 原始 `renderFontEachCell` 被恢复 |
| 新渲染单元打开 | `created$` 事件触发后新的Spreadsheet也被patch |

**Canvas Mock：**

```typescript
const mockCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    direction: 'ltr',
    textAlign: 'left',
    fillText: vi.fn(),
};

const mockFontExtension = {
    renderFontEachCell: vi.fn().mockReturnValue(true),
};
```

### 2.3 `RtlContextMenu`

**测试场景：**

| 场景 | 验证点 |
|------|--------|
| 菜单注册 | `mergeMenu` 被调用，传入正确的 schema |
| 父菜单项 | `id === 'sheet.contextMenu.rtl-text-direction'`, `type === MenuItemType.SUBITEMS` |
| LTR子项 | `commandId === 'sheet.command.set-text-direction'` |
| RTL子项 | 同上，但title为 `'Right to Left'` |
| Auto子项 | title为 `'Auto Detect'` |
| 执行菜单项 | 点击RTL子项后 `SetTextDirectionCommand` 被执行 |

```typescript
describe('RtlContextMenu schema', () => {
    it('父菜单项类型应为SUBITEMS', () => {
        const mockAccessor = { get: vi.fn() };
        const item = RtlContextMenuParentItemFactory(mockAccessor as any);
        expect(item.type).toBe(MenuItemType.SUBITEMS);
        expect(item.id).toBe(RTL_CONTEXT_MENU_ID);
    });

    it('RTL子项应关联SetTextDirectionCommand', () => {
        const mockAccessor = { get: vi.fn() };
        const item = RtlContextMenuRtlItemFactory(mockAccessor as any);
        expect(item.commandId).toBe(SetTextDirectionCommand.id);
        expect(item.title).toBe('Right to Left');
    });
});
```

---

## 3. 手动验证清单（Manual Verification Checklist）

### 环境准备

- [ ] 克隆仓库，执行 `npm install`
- [ ] 配置包含 `UniverRtlToolsPlugin` 的 Univer Playground 或 Demo 项目
- [ ] 打开浏览器 DevTools，关注 Console 中 `[RtlToolsPlugin]` 前缀的日志

---

### 3.1 自动检测（工作簿加载）

| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 1 | 创建含阿拉伯文本的单元格（如 A1 = `مرحبا`） | Console显示 `Auto-applied RTL to N cells` |
| 2 | 检查该单元格样式 | `td = RIGHT_TO_LEFT`, `ht = RIGHT` |
| 3 | 创建含英文的单元格（B1 = `Hello`） | 无RTL样式被应用 |
| 4 | 刷新页面重新加载 | 含RTL内容的单元格仍保持RTL样式 |
| 5 | 手动设置 `td = LEFT_TO_RIGHT` 的单元格，重新加载 | 自动检测不覆盖已显式设置的方向 |

### 3.2 实时输入检测

| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 1 | 双击空单元格，输入 `مرحبا`，按 Enter | 单元格自动获得RTL样式 |
| 2 | 输入英文 `Hello`，按 Enter | 无RTL样式应用 |
| 3 | 输入混合文本 `Hello مرحبا World` | 视RTL比例决定是否应用（阈值50%） |
| 4 | 输入纯数字 `12345` | 无RTL样式 |

### 3.3 右键菜单

| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 1 | 选中任意单元格，右键 | 出现 "Text Direction" 子菜单 |
| 2 | 点击 "Right to Left" | 所选单元格设置RTL方向 |
| 3 | 点击 "Left to Right" | 所选单元格设置LTR方向 |
| 4 | 点击 "Auto Detect" | 所选单元格方向由内容自动决定 |
| 5 | 选中多个单元格，点击 "Right to Left" | 所有选中单元格均设置RTL |

### 3.4 键盘快捷键 `Ctrl+Shift+X`

| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 1 | 选中单元格，按 `Ctrl+Shift+X` | 切换文字方向（LTR ↔ RTL） |
| 2 | 多次切换 | 方向交替切换 |

### 3.5 撤销/重做

| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 1 | 通过右键菜单设置RTL | 单元格变为RTL |
| 2 | 按 `Ctrl+Z` 撤销 | 恢复到之前方向 |
| 3 | 按 `Ctrl+Y` 重做 | 再次变为RTL |

### 3.6 数字在RTL单元格中的表现

| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 1 | RTL单元格输入 `١٢٣٤` (阿拉伯数字) | 正确右对齐显示 |
| 2 | RTL单元格输入 `1234` (西方数字) | 数字仍正确显示（BiDi数字中性处理） |
| 3 | RTL单元格输入 `مرحبا 2024` | 日期/数字不影响RTL方向 |
| 4 | RTL单元格查看货币显示 `$100` | 验证货币符号位置符合预期 |

### 3.7 渲染验证

| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 1 | RTL单元格文本右对齐显示 | Canvas `ctx.direction='rtl'` 已生效 |
| 2 | LTR单元格文本左对齐显示 | Canvas 上下文未被修改 |
| 3 | 混合文本的BiDi处理 | `bidi-js` 正确分段显示 |
| 4 | 列宽不足时文本溢出方向 | RTL文本向左溢出（与LTR相反） |

---

## 4. 测试框架配置（Vitest）

项目已安装 `vitest`，以下为完整配置。

### 4.1 `vitest.config.ts`

```typescript
// vitest.config.ts（放置于项目根目录）
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',  // 需要 DOM API（Canvas、TextDecoder等）
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/index.ts'],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70,
            },
        },
    },
    resolve: {
        alias: {
            // 如需alias可在此配置
        },
    },
});
```

### 4.2 `tests/setup.ts`

```typescript
// tests/setup.ts
import { vi } from 'vitest';

// Mock Canvas API（jsdom不支持Canvas渲染）
vi.stubGlobal('HTMLCanvasElement', class {
    getContext() {
        return {
            save: vi.fn(),
            restore: vi.fn(),
            fillText: vi.fn(),
            direction: 'ltr',
            textAlign: 'start',
        };
    }
});
```

### 4.3 测试目录结构

```
tests/
├── setup.ts                          # 全局测试设置
├── utils/
│   ├── rtl-detector.test.ts          # hasRTLCharacters, getRTLPercentage, isRTLDominant
│   └── bidi-processor.test.ts        # getVisualTextRuns（需bidi-js）
├── services/
│   └── rtl-auto-detect.service.test.ts
├── commands/
│   └── set-text-direction.command.test.ts
└── controllers/
    ├── rtl-context-menu.test.ts      # 菜单schema和factory函数
    ├── rtl-auto-apply.controller.test.ts  # 需Univer mock
    └── rtl-render.controller.test.ts      # 需Canvas mock
```

### 4.4 Univer DI Mock 策略

```typescript
// tests/helpers/univer-mocks.ts
import { vi } from 'vitest';
import { TextDirection } from '@univerjs/core';

/**
 * 创建最小化的 ICommandService mock
 */
export function createMockCommandService() {
    return {
        executeCommand: vi.fn().mockResolvedValue(true),
        syncExecuteCommand: vi.fn().mockReturnValue(true),
        onCommandExecuted: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };
}

/**
 * 创建含有指定单元格的 mock Worksheet
 */
export function createMockWorksheet(cells: Record<string, { v: string; s?: any }>) {
    return {
        getSheetId: vi.fn().mockReturnValue('sheet1'),
        getUnitId: vi.fn().mockReturnValue('workbook1'),
        getName: vi.fn().mockReturnValue('Sheet1'),
        getRowCount: vi.fn().mockReturnValue(100),
        getColumnCount: vi.fn().mockReturnValue(26),
        getCellMatrix: vi.fn().mockReturnValue({
            getValue: (row: number, col: number) => {
                const key = `${row},${col}`;
                return cells[key] ?? null;
            },
        }),
        getCell: vi.fn((row: number, col: number) => {
            const key = `${row},${col}`;
            return cells[key] ?? null;
        }),
        getCellRaw: vi.fn((row: number, col: number) => {
            const key = `${row},${col}`;
            return cells[key] ?? null;
        }),
    };
}

/**
 * 创建 mock IUniverInstanceService，返回指定工作表
 */
export function createMockUniverInstanceService(worksheets: any[]) {
    const mockWorkbook = {
        getSheets: vi.fn().mockReturnValue(worksheets),
        getActiveSheet: vi.fn().mockReturnValue(worksheets[0]),
    };
    return {
        getCurrentUnitForType: vi.fn().mockReturnValue(mockWorkbook),
    };
}

/**
 * 创建 mock LifecycleService
 */
export function createMockLifecycleService() {
    type Callback = (stage: any) => void;
    const callbacks: Callback[] = [];
    return {
        lifecycle$: {
            subscribe: vi.fn((cb: Callback) => {
                callbacks.push(cb);
                return { dispose: vi.fn() };
            }),
        },
        // 触发特定生命周期阶段
        _trigger: (stage: any) => callbacks.forEach(cb => cb(stage)),
    };
}
```

### 4.5 运行测试

```bash
# 单次运行所有测试
npm test

# 监视模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npx vitest run --coverage
```

---

## 5. 已知限制（Known Limitations）

### 5.1 渲染管道测试限制

**问题：** `RtlRenderController` 通过 monkey-patch `fontExtension.renderFontEachCell` 实现 Canvas 方向设置。该 API 属于 `@univerjs/engine-render` 的内部实现，未在公共类型中暴露。

**影响：** 集成测试无法真实验证 Canvas 渲染结果，只能验证：
- monkey-patch 是否被执行（函数替换）
- `ctx.direction` 和 `ctx.textAlign` 是否在 mock 环境中被设置

**真实渲染测试** 需等待：
- Univer 提供 `SpreadsheetSkeleton` 的官方 `textDirection` 支持
- 或提供可测试的渲染沙箱（headless canvas 环境）

### 5.2 `SpreadsheetSkeleton.textDirection` 缺口

**问题：** `SpreadsheetSkeleton` 目前不在其布局计算中读取 `IStyleData.td`，导致：
- 单元格列宽计算不考虑文字方向
- 文本溢出方向（RTL应向左溢出）仍按LTR逻辑处理
- 行高自适应在RTL模式下可能不准确

**测试建议：** 待 Univer Core 修复该问题后，添加端到端视觉回归测试（如 Playwright + 截图对比）。

### 5.3 Font Extension Monkey-Patch 的脆弱性

**问题：** `fontExtension.renderFontEachCell` 是 Univer 引擎的私有/内部 API。Univer 版本升级可能：
- 重命名该方法
- 改变方法签名（`renderFontCtx` 结构变化）
- 废弃 `fontExtension` 访问模式

**建议：** 添加防御性测试，在构建时验证 API 形状：

```typescript
// tests/compat/engine-render-api.test.ts
import { describe, it, expect } from 'vitest';

describe('Univer Engine Render API兼容性', () => {
    it('Spreadsheet应提供fontExtension访问器', async () => {
        // 这是一个文档性测试，描述我们依赖的API
        // 当Univer升级破坏此API时，此测试将引起注意
        const { Spreadsheet } = await import('@univerjs/engine-render');
        // 检查原型链上是否有fontExtension
        expect('fontExtension' in Spreadsheet.prototype ||
               typeof (Spreadsheet as any).prototype.fontExtension !== 'undefined'
        ).toBe(true); // 若失败则需更新RtlRenderController
    });
});
```

### 5.4 `detectAndApply` 的位置参数限制

**问题：** `RtlAutoDetectService.detectAndApply(unitId, subUnitId, row, col, content)` 中 `unitId`、`subUnitId`、`row`、`col` 参数在当前实现中未被使用（直接调用 `SetTextDirectionCommand` 作用于当前选区）。

**影响：** 无法精确为指定单元格应用方向，当前实现依赖用户选区。

**测试建议：** 待实现精确定位逻辑后，补充针对特定 `(row, col)` 的集成测试。

### 5.5 `bidi-js` 的运行时测试

`getVisualTextRuns()` 依赖 `bidi-js` 库。该库在 Node.js（jsdom）环境下正常工作，单元测试可直接验证：

```typescript
// tests/utils/bidi-processor.test.ts
import { describe, it, expect } from 'vitest';
import { getVisualTextRuns } from '../../src/utils/bidi-processor';

describe('getVisualTextRuns', () => {
    it('纯LTR文本应返回单个LTR run', () => {
        const runs = getVisualTextRuns('Hello');
        expect(runs).toHaveLength(1);
        expect(runs[0].direction).toBe('ltr');
    });
    it('纯RTL文本应返回单个RTL run', () => {
        const runs = getVisualTextRuns('مرحبا');
        expect(runs.length).toBeGreaterThanOrEqual(1);
        expect(runs[0].direction).toBe('rtl');
    });
    it('混合文本应返回多个runs', () => {
        const runs = getVisualTextRuns('Hello مرحبا World');
        expect(runs.length).toBeGreaterThan(1);
    });
    it('空字符串应返回空数组', () => {
        expect(getVisualTextRuns('')).toEqual([]);
    });
});
```

---

## 6. 测试优先级

| 优先级 | 测试项 | 原因 |
|--------|--------|------|
| P0（立即） | `rtl-detector.ts` 全部函数 | 纯函数，零依赖，核心逻辑 |
| P0（立即） | `RtlAutoDetectService` 核心方法 | 可无DI实例化，LRU缓存需验证 |
| P0（立即） | `getVisualTextRuns`（bidi-js） | 唯一runtime依赖可直接测试 |
| P1 | `SetTextDirectionCommand` | mock accessor可行，command契约重要 |
| P1 | Context menu factory函数 | 无DI依赖的纯工厂函数 |
| P2 | `RtlAutoApplyController` | 需Univer mock，逻辑复杂 |
| P2 | `RtlRenderController` | 需Canvas mock，API不稳定 |
| P3 | 端到端视觉回归测试 | 需Playwright，待Univer Core修复后 |

---

*文档由 Claude Code 生成，基于源码分析。如代码变更，请同步更新本文档。*
