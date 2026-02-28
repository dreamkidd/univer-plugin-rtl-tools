# RTL 支持调研报告

> 调研日期：2026-02-27
> 调研范围：Google Sheets、Excel、Univer Core API、Canvas RTL 渲染、开源电子表格

---

## 一、业界标杆

### 1.1 Google Sheets

| 功能 | 实现 |
|------|------|
| **Sheet 级 RTL** | Format > Direction > Sheet right-to-left。列从右到左排列（A 在最右），滚动条移至左侧，Tab 导航反转 |
| **单元格方向** | Format > Direction > Text right-to-left。三选项：LTR / RTL / Automatic |
| **自动检测** | 输入阿拉伯文/希伯来文时自动切换为 RTL 对齐，输入英文自动回 LTR |
| **混合文本** | 浏览器原生 Bidi 算法处理，数字保持 LTR 显示 |
| **RTL 控件** | 默认隐藏，需在 Tools > Settings 勾选 "Always show right-to-left controls" |
| **粒度** | Sheet 级和 Cell 级独立控制，同一工作簿可混合 LTR/RTL Sheet |
| **公式** | 公式引用逻辑不变（A1 仍是 A1），只是视觉位置翻转 |
| **合并单元格** | RTL 模式下文本溢出默认向左延伸 |

### 1.2 Excel

| 功能 | 实现 |
|------|------|
| **Sheet 级 RTL** | Page Layout > Sheet Right-to-Left。列从右到左、滚动条移左、行号在右 |
| **单元格方向** | Format Cells > Alignment > Text direction：Context / LTR / RTL |
| **Context 模式** | 默认值。根据首个强方向字符自动判断方向（非占比阈值） |
| **OOXML 存储** | Sheet 级：`<sheetView rightToLeft="1"/>`。Cell 级：`<alignment readingOrder="0\|1\|2"/>` |
| **readingOrder 值** | 0 = Context（自动），1 = LTR，2 = RTL |
| **Excel Online** | **不支持 Sheet RTL**，确认 Web 端实现 Sheet 级 RTL 的高复杂度 |
| **数字** | 不受 RTL 影响，始终保持正常显示 |

### 1.3 OOXML 与 Univer 枚举映射

| OOXML `readingOrder` | 值 | Univer `TextDirection` | 值 |
|----------------------|---|----------------------|---|
| Context（自动检测） | 0 | `UNSPECIFIED` | 0 |
| Left-to-Right | 1 | `LEFT_TO_RIGHT` | 1 |
| Right-to-Left | 2 | `RIGHT_TO_LEFT` | 2 |

xlsx 导入/导出时可直接映射，无需转换。

---

## 二、Univer Core 已有的 RTL 基础设施

### 2.1 已支持（数据模型层）

| 能力 | 位置 | 说明 |
|------|------|------|
| `TextDirection` 枚举 | `@univerjs/core` | `UNSPECIFIED(0)`, `LEFT_TO_RIGHT(1)`, `RIGHT_TO_LEFT(2)` |
| `IStyleData.td` | `@univerjs/core` | 单元格样式中的 textDirection 字段 |
| `IWorksheetData.rightToLeft` | `@univerjs/core` | Sheet 级 RTL 字段 |
| `Worksheet.isRightToLeft()` | `@univerjs/core` | 读取方法已实现 |
| `Range.getTextDirection()` | `@univerjs/core` | 单元格方向读取已实现（只读，无 setter） |
| `UniverRenderingContext2D.direction` | `@univerjs/engine-render` | Canvas 渲染上下文已暴露 direction 属性 |
| `IParagraphProperties.direction` | `@univerjs/core` | 文档段落级方向字段已定义 |
| `ArabicHandler` | `@univerjs/engine-render` | 阿拉伯字符基础处理（仅字形反转，非完整 Bidi） |

### 2.2 未支持（渲染管线断点）

| 缺口 | 说明 |
|------|------|
| **SpreadsheetSkeleton 断点** | `_getCellDocumentModel()` → `_getOtherStyle()` 取出 textDirection，但 `_getDocumentDataByStyle()` 构建 paragraphStyle 时**未传入 textDirection** |
| **Font extension 不设置 ctx.direction** | `UniverRenderingContext2D.direction` 已暴露但从未使用 |
| **IFontCacheItem 缺少 textDirection** | 字体缓存无 direction 字段，缓存命中后方向信息丢失 |
| **Range 缺少 setTextDirection()** | 只有 getter 没有 setter，写入只能通过 mutation |
| **Sheet 级 rightToLeft 渲染未对接** | 字段和 API 已存在，但渲染层未消费 |
| **无完整 Unicode Bidi 算法** | ArabicHandler 只是字符级反转，非完整 UAX#9 实现 |

### 2.3 关键文件路径

| 文件 | 内容 |
|------|------|
| `@univerjs/core/.../enum/text-style.d.ts` | TextDirection、HorizontalAlign 枚举 |
| `@univerjs/core/.../interfaces/i-style-data.d.ts` | IStyleData.td 字段定义 |
| `@univerjs/core/.../sheets/typedef.d.ts` | IWorksheetData.rightToLeft 字段 |
| `@univerjs/core/.../sheets/worksheet.d.ts` | Worksheet.isRightToLeft() 方法 |
| `@univerjs/core/.../sheets/range.d.ts` | Range.getTextDirection() 方法 |
| `@univerjs/core/.../interfaces/i-document-data.d.ts` | IParagraphProperties.direction 字段 |
| `@univerjs/engine-render/.../context.d.ts` | Canvas direction 属性 |
| `@univerjs/engine-render/.../sheet-skeleton.d.ts` | SpreadsheetSkeleton（渲染骨架）|
| `@univerjs/engine-render/.../extensions/font.d.ts` | Font 渲染扩展 |

---

## 三、Canvas 2D RTL 渲染技术

| 方案 | 结论 |
|------|------|
| `ctx.direction = 'rtl'` | **推荐。** 所有现代浏览器支持，fillText 自动处理 Bidi，阿拉伯文连字正确 |
| `ctx.textAlign = 'right'` | 必须配合 `direction='rtl'` 使用 |
| `measureText` | 在 `direction='rtl'` 下返回正确的文本宽度 |
| bidi-js 手动分段 | **不推荐。** 浏览器 Canvas 已原生支持 Bidi，手动分段反而可能破坏连字 |

**关键结论：** Canvas `fillText` 在设置 `ctx.direction = 'rtl'` 后，浏览器会自动应用 Unicode Bidi Algorithm，包括阿拉伯文连字、混合文本重排。不需要手动实现 Bidi 分段。

---

## 四、开源电子表格对比

| 项目 | 渲染方式 | RTL 支持 | 实现层 |
|------|----------|----------|--------|
| **Handsontable** | DOM | 完整（v12+） | CSS `direction: rtl` + JS 虚拟化适配。`layoutDirection` 配置项，初始化时设置，不可动态切换 |
| **AG Grid** | DOM | 完整 | `enableRtl: true`，CSS `ag-rtl` 类 + 列位置数学反转 + 滚动逻辑反转 |
| **Luckysheet/Fortune-sheet** | Canvas | **无** | 无 RTL 功能 |
| **SheetJS** | 无渲染 | 读写支持 | `ws['!views'][0].rightToLeft` 读写 xlsx RTL 属性 |

**结论：** DOM-based 表格（Handsontable、AG Grid）通过 CSS `direction` 实现 RTL。Canvas-based 表格（Luckysheet、Univer）没有现成方案，需要在渲染层做特殊处理。

---

## 五、插件边界

### 5.1 插件做的（单元格文本方向）

| 功能 | 说明 |
|------|------|
| RTL 文本检测 | 检测单元格内容是否为 RTL 语言，采用"首个强方向字符"策略（对齐 Excel Context 行为） |
| 自动设置 td + ht | 新输入检测到 RTL 后通过命令设置 `TextDirection.RIGHT_TO_LEFT` + `HorizontalAlign.RIGHT` |
| 手动设置方向 | 右键菜单三选项：LTR / RTL / Auto（对齐 Excel/Google Sheets） |
| 渲染层拦截 | 在 Font extension 断点处注入 `ctx.direction = 'rtl'`，作为 Core 修复前的临时方案 |
| 快捷键 | Ctrl+Shift+X 对选区切换方向 |

### 5.2 插件不做的

| 功能 | 原因 |
|------|------|
| Sheet 级 RTL 布局（列反转、滚动条、行号） | 需要 Core 深度改动，Excel Online 也不支持 |
| 全局 UI 翻转（工具栏、侧边栏方向） | 框架层 i18n/layout 的范围 |
| bidi-js 手动文本分段 | Canvas 原生支持 Bidi |
| RLM 字符注入（修改 cell.v） | 侵入用户数据，绕过命令系统 |
| 状态栏指示器 | 随全局布局切换移除 |

### 5.3 提给 Univer Core 的 Issue

| Issue | 优先级 | 描述 |
|-------|--------|------|
| SpreadsheetSkeleton 断点 | P0 | `_getDocumentDataByStyle` 不传递 textDirection 到 paragraphStyle |
| Font extension 不设置 ctx.direction | P0 | `UniverRenderingContext2D.direction` 已暴露但从未使用 |
| IFontCacheItem 缺少 textDirection | P1 | 字体缓存无 direction 字段 |
| Range 缺少 setTextDirection() | P2 | 只有 getter 无 setter |
| Sheet 级 rightToLeft 渲染未对接 | P2 | 字段存在但渲染层未消费 |

---

## 六、精简后的插件架构

```
src/
├── rtl-plugin.ts                       # 插件入口
├── commands/
│   └── set-text-direction.command.ts   # 设置单元格方向
├── controllers/
│   ├── rtl-auto-apply.controller.ts    # 自动检测 + 标记
│   ├── rtl-render.controller.ts        # 渲染拦截（临时 hack）
│   └── menu/
│       └── rtl-context-menu.ts         # 右键菜单
├── services/
│   └── rtl-auto-detect.service.ts      # 检测服务
├── shortcuts/
│   └── rtl-shortcuts.ts                # Ctrl+Shift+X
├── utils/
│   └── rtl-detector.ts                 # RTL 字符检测
└── index.ts                            # 精简导出

删除项：
- rtl-css.controller.ts（全局 CSS 布局）
- rtl-ui.controller.ts（重复注册 + mock 数据）
- rtl-status.controller.ts（状态指示器）
- rtl-status-indicator.ts（状态指示器视图）
- bidi-processor.ts（手动 Bidi 分段）
- toggle-rtl.command.ts（全局切换命令）
- bidi-js 依赖
```
