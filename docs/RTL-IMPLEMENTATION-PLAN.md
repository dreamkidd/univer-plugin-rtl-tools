# Univer RTL 完整实现方案

> 基于 Phase 2 对 `@univerjs/ui@0.4.2` 和 `@univerjs/engine-render@0.4.2` 的深度研究

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    UniverRtlToolsPlugin                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ RtlCssCtrl   │  │ RtlRenderCtrl│  │ RtlUICtrl     │  │
│  │ (UI 框架层)   │  │ (Canvas渲染层)│  │ (工具栏/菜单)  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│   dir="rtl"         FontAndBaseLine      Toggle按钮     │
│   CSS注入            扩展替换/补丁        快捷键绑定     │
│         │                 │                   │          │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌───────▼───────┐  │
│  │ DOM容器       │  │ Canvas       │  │ IMenuManager  │  │
│  │ .univer-     │  │ fillText()   │  │ 注册菜单项     │  │
│  │ workbench-   │  │ ctx.direction│  │               │  │
│  │ layout       │  │ bidi-js重排   │  │               │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

RTL 支持分为 **三个独立层**，每层可单独启用：

| 层 | 职责 | 方法 | 是否需要 Fork |
|----|------|------|--------------|
| **Layer 1: UI 框架** | 工具栏/侧边栏/菜单镜像 | CSS 注入 + `dir` 属性 | 否 |
| **Layer 2: Cell 文本** | 单元格内 RTL 文本渲染 | 扩展替换 + monkey-patch | 否 |
| **Layer 3: Sheet 布局** | 列从右到左排列 | 渲染引擎扩展 | 可能需要 |

---

## 二、现有基础设施（已确认可用）

### 2.1 数据模型（@univerjs/core）

Univer 核心已内置 RTL 枚举，无需扩展数据模型：

```typescript
// @univerjs/core - lib/types/types/enum/text-style.d.ts
enum TextDirection {
    UNSPECIFIED = 0,
    LEFT_TO_RIGHT = 1,
    RIGHT_TO_LEFT = 2
}

// IStyleData.td — 单元格级别文本方向
interface IStyleData {
    td?: TextDirection;  // 可直接使用
}

// IParagraphStyle.direction — 段落级别
interface IParagraphStyle {
    direction?: TextDirection;
}

// ISectionBreakBase.contentDirection — 节级别
interface ISectionBreakBase {
    contentDirection?: TextDirection;
}
```

### 2.2 已完成模块

| 模块 | 文件 | 状态 |
|------|------|------|
| RTL 字符检测 | `src/utils/rtl-detector.ts` | Phase 1 完成 |
| Bidi 文本重排 | `src/utils/bidi-processor.ts` | Phase 1 完成 |
| bidi-js 类型声明 | `src/types/bidi-js.d.ts` | Phase 1 完成 |
| UI CSS 注入 | `src/controllers/rtl-css.controller.ts` | Phase 2 完成 |
| 插件入口 | `src/rtl-plugin.ts` | Phase 2 更新 |
| 切换命令 | `src/commands/toggle-rtl.command.ts` | Phase 2 更新 |

---

## 三、Layer 1: UI 框架 RTL（已实现）

### 3.1 注入点

通过 `ILayoutService.rootContainerElement` 获取根容器（`.univer-workbench-layout`），设置：

```typescript
container.setAttribute('dir', 'rtl');
container.setAttribute('data-u-rtl', 'true');
```

### 3.2 DOM 结构

```
[mountContainer]
└── .univer-workbench-layout          ← 注入 dir="rtl" 的位置
    ├── .univer-workbench-container
    │   ├── .univer-workbench-container-header
    │   │   ├── .univer-headerbar
    │   │   │   └── .univer-header-menu      ← 需要 right→left
    │   │   ├── .univer-menubar
    │   │   └── .univer-toolbar
    │   │       └── .univer-toolbar-container ← 需要 row-reverse
    │   └── .univer-workbench-container-wrapper  ← CSS Grid, 需要 direction:rtl
    │       ├── .univer-workbench-container-left-sidebar
    │       ├── .univer-workbench-container-content
    │       │   └── canvas                    ← Canvas 不受 CSS direction 影响
    │       └── .univer-workbench-container-sidebar
    │           └── .univer-sidebar           ← 需要 translate(-100%)
    └── .univer-notification
```

### 3.3 CSS 覆盖策略

使用 `[data-u-rtl="true"]` 属性选择器，避免全局污染。关键覆盖项：

| 目标 | CSS 类名 | 覆盖内容 |
|------|---------|---------|
| 工具栏 | `.univer-toolbar-container` | `flex-direction: row-reverse` |
| 下拉箭头 | `.univer-toolbar-item-select-button` | padding 方向翻转 |
| 标题菜单 | `.univer-headerbar > .univer-header-menu` | `right: auto; left: 0` |
| 侧边栏 | `.univer-sidebar` | `transform: translate(-100%)` |
| 侧边栏边框 | `.univer-sidebar-container` | `border-left → border-right` |
| 菜单项图标 | `.univer-menu-item-selectable` | padding 方向翻转 |
| 公式栏 | `.univer-formula-bar` | `direction: rtl; text-align: right` |

### 3.4 已知局限

- Univer 0.4.x 的 CSS 全是 `univer-` 前缀的全局类名（非 CSS Modules），选择器稳定性较好
- Canvas 渲染不受 CSS `direction` 影响，需要 Layer 2 单独处理
- 第三方插件（如 `@univerjs/sheets-formula`）的 UI 可能需要额外覆盖

---

## 四、Layer 2: Cell 文本 RTL 渲染（待实现，核心重点）

### 4.1 渲染管线分析

```
DocumentDataModel
  → DocumentViewModel (DataStreamTreeNode tree)
    → DocumentSkeleton.calculate()
      → pages → sections → columns → lines → divides → glyphs
        → Documents.draw()
          → FontAndBaseLine.draw()   ← 实际 fillText 调用点
            → ctx.fillText(content, x, y)
```

**核心问题：** Skeleton 计算 `glyph.left` 时始终假设 LTR，没有 bidi 重排逻辑。

### 4.2 关键类和 API

```typescript
// 渲染上下文 — ctx.direction 已暴露但从未使用
interface UniverRenderingContext2D {
    direction: CanvasDirection;  // 可设置为 'rtl' | 'ltr'
    textAlign: CanvasTextAlign;
    fillText(text: string, x: number, y: number): void;
}

// Sheet 扩展注册表
const SpreadsheetExtensionRegistry: Registry<any>;  // 全局注册

// Spreadsheet 实例
class Spreadsheet {
    get fontExtension(): Font;  // 公开的 getter，可 monkey-patch
    register(...extensions): IDisposable;
}

// 获取 Spreadsheet 实例的路径
IRenderManagerService.getRenderById(unitId) → IRender
  → render.mainComponent as Spreadsheet

// Font 扩展
class Font extends SheetExtension {
    uKey = 'DefaultSheetFontExtensionUniqueKey';
    Z_INDEX = 45;
    draw(ctx, parentScale, skeleton, diffRanges, drawInfo): void;
    renderFontEachCell(/*...*/): void;  // 逐 cell 渲染
}

// Document 扩展注册表（用于 cell 内文本渲染）
const DocumentsSpanAndLineExtensionRegistry: Registry<any>;

// 文档文本扩展
class FontAndBaseLine extends docExtension {
    uKey = 'DefaultDocsFontAndBaseLineExtension';
    Z_INDEX = 20;
    draw(ctx, parentScale, glyph): void;
      → ctx.fillText(content, spanPointWithFont.x, spanPointWithFont.y)
}
```

### 4.3 推荐方案：Combined Approach

经过四种方案评估，推荐 **插件扩展 + 最小 monkey-patch** 组合：

#### 方案评分对比

| 方案 | 可行性 | 可维护性 | 完整性 | 推荐 |
|------|--------|---------|--------|------|
| 纯插件扩展 | 4/5 | 5/5 | 3/5 | 部分 |
| 纯 Monkey-patch | 4/5 | 2/5 | 5/5 | 风险高 |
| Fork | 3/5 | 1/5 | 5/5 | 不推荐 |
| **Combined** | **4/5** | **3/5** | **4/5** | **推荐** |

#### 实现架构

```
RtlRenderController (新建)
├── 获取 Spreadsheet 实例 via IRenderManagerService
├── Monkey-patch fontExtension.renderFontEachCell
│   ├── 检测 cell 的 IStyleData.td === TextDirection.RIGHT_TO_LEFT
│   ├── 调用 bidi-js 对文本进行视觉重排
│   ├── 设置 ctx.direction = 'rtl', ctx.textAlign = 'right'
│   └── 使用重排后的文本 fillText
└── 或: 注册自定义 docExtension 替换 FontAndBaseLine
    ├── uKey = 'DefaultDocsFontAndBaseLineExtension' (相同 key 替换原有)
    └── draw() 中添加 RTL 逻辑
```

#### 方案 A：Monkey-patch Font.renderFontEachCell（推荐首选）

```typescript
// src/controllers/rtl-render.controller.ts

import { Disposable, Inject, Injector, OnLifecycle, LifecycleStages } from '@univerjs/core';
import { IRenderManagerService } from '@univerjs/engine-render';
import { getVisualTextRuns } from '../utils/bidi-processor';
import { isRTLDominant } from '../utils/rtl-detector';

@OnLifecycle(LifecycleStages.Rendered, RtlRenderController)
export class RtlRenderController extends Disposable {
    constructor(
        @Inject(IRenderManagerService) private _renderManagerService: IRenderManagerService
    ) {
        super();
        this._patchFontRendering();
    }

    private _patchFontRendering(): void {
        // 获取当前 render unit
        const render = this._renderManagerService.getCurrentTypeOfRenderer(/* UniverInstanceType.UNIVER_SHEET */);
        if (!render) return;

        const spreadsheet = render.mainComponent;
        const fontExt = spreadsheet.fontExtension;

        // 保存原始方法
        const originalRenderFont = fontExt.renderFontEachCell.bind(fontExt);

        // Monkey-patch
        fontExt.renderFontEachCell = (ctx, cell, cellBounds, style, ...rest) => {
            const textDirection = style?.td;

            if (textDirection === 2 /* TextDirection.RIGHT_TO_LEFT */) {
                ctx.save();
                ctx.direction = 'rtl';
                ctx.textAlign = 'right';
                // 使用 bidi-js 重排文本后渲染
                // ...具体实现需要根据 renderFontEachCell 的实际参数签名调整
                originalRenderFont(ctx, cell, cellBounds, style, ...rest);
                ctx.restore();
            } else {
                originalRenderFont(ctx, cell, cellBounds, style, ...rest);
            }
        };

        // 清理
        this.disposeWithMe({
            dispose: () => {
                fontExt.renderFontEachCell = originalRenderFont;
            },
        });
    }
}
```

#### 方案 B：替换 DocumentsSpanAndLineExtension（备选）

```typescript
// 替换 FontAndBaseLine 扩展，在 glyph 级别处理 RTL

import { DocumentsSpanAndLineExtensionRegistry } from '@univerjs/engine-render';

class RtlFontAndBaseLine extends docExtension {
    uKey = 'DefaultDocsFontAndBaseLineExtension';  // 相同 key = 替换
    type = DOCS_EXTENSION_TYPE.SPAN;
    Z_INDEX = 20;

    draw(ctx: UniverRenderingContext, parentScale: IScale, glyph: IDocumentSkeletonGlyph): void {
        const { content } = glyph;
        const { spanPointWithFont } = this.extensionOffset;

        // 检测是否包含 RTL 字符
        if (hasRTLCharacters(content)) {
            ctx.save();
            ctx.direction = 'rtl';
            // 翻转 x 坐标: 使用 divide 宽度 - 原始 x
            const rtlX = /* divideWidth */ - spanPointWithFont.x;
            ctx.fillText(content, rtlX, spanPointWithFont.y);
            ctx.restore();
        } else {
            ctx.fillText(content, spanPointWithFont.x, spanPointWithFont.y);
        }
    }
}

// 注册（相同 uKey 替换原有扩展）
DocumentsSpanAndLineExtensionRegistry.add(new RtlFontAndBaseLine());
```

### 4.4 RTL Cell 检测策略

Cell 是否启用 RTL 的判断优先级：

```
1. 用户手动设置 IStyleData.td = TextDirection.RIGHT_TO_LEFT  (最高优先)
2. 自动检测: isRTLDominant(cellContent) 超过阈值 (0.5)
3. Sheet 级别默认方向设置 (如有)
4. 默认 LTR
```

### 4.5 Bidi 文本重排流程

对于 RTL cell 中的混合文本（如 "Hello مرحبا World"）：

```
输入 (逻辑顺序): "Hello مرحبا World"
                  ↓
          bidi-js getEmbeddingLevels()
                  ↓
          levels: [0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0]
                  ↓
          getReorderSegments() → flip ranges
                  ↓
          应用 flip → 视觉顺序索引
                  ↓
          getVisualTextRuns()
                  ↓
输出 (视觉顺序): [
    { text: "Hello ", direction: "ltr", level: 0 },
    { text: "ابحرم", direction: "rtl", level: 1 },
    { text: " World", direction: "ltr", level: 0 }
]
                  ↓
          逐 run 调用 fillText()，RTL run 从右向左绘制
```

---

## 五、Layer 3: Sheet 布局 RTL（未来规划）

### 5.1 目标

实现整个工作表从右到左布局：
- 列号从右到左排列（A 列在最右）
- 行号在右侧
- 滚动方向镜像

### 5.2 难度评估

这一层**最可能需要 Fork**，因为涉及：
- `SheetSkeleton` 的列位置计算（硬编码 LTR）
- 行/列头渲染（`SheetRowHeaderExtensionRegistry` / `SheetColumnHeaderExtensionRegistry`）
- 滚动和视口（Viewport）坐标系
- 选区（Selection）绘制方向

### 5.3 初步方案

```
选项 A: Transform 镜像（快速但有副作用）
  - 对 Canvas 容器应用 CSS transform: scaleX(-1)
  - 内部文本再 scaleX(-1) 抵消
  - 问题: 鼠标事件坐标需要全部镜像

选项 B: 渲染引擎修改（完整但需 Fork）
  - 修改 SheetSkeleton 的列位置计算
  - 修改 Viewport 的滚动逻辑
  - 修改 Selection 的绘制坐标
  - 需要 Fork: @univerjs/engine-render, @univerjs/sheets-ui

选项 C: 自定义 SheetExtension 覆盖（部分可行）
  - 用自定义扩展重新计算列位置
  - 但无法覆盖 Viewport 滚动逻辑
```

**建议：Layer 3 暂不实施，优先完成 Layer 1 + Layer 2。如有需求再评估 Fork 方案。**

---

## 六、实施路线图

### Phase 1: 基础工具 ✅ 已完成

- [x] RTL 字符检测 (`rtl-detector.ts`)
- [x] Bidi 文本重排 (`bidi-processor.ts`)
- [x] bidi-js 类型声明
- [x] 单元测试 (28 tests passing)

### Phase 2: UI 框架 RTL ✅ 已完成

- [x] RtlCssController — CSS 注入 + dir 属性
- [x] 精确 Univer CSS 类名覆盖
- [x] Toggle 命令接入 RtlCssController
- [x] 插件生命周期注册
- [x] 渲染引擎研究文档

### Phase 3: Cell 文本 RTL 渲染 (下一步)

- [ ] 创建 `RtlRenderController`
- [ ] 通过 `IRenderManagerService` 获取 Spreadsheet 实例
- [ ] Monkey-patch `fontExtension` 或替换 `FontAndBaseLine` 扩展
- [ ] 集成 bidi-js 视觉重排
- [ ] Cell 级别 RTL 自动检测
- [ ] 用户手动设置 RTL 方向（通过 `SetRangeValuesCommand` 修改 `IStyleData.td`）
- [ ] 添加渲染层单元测试

### Phase 4: UI 完善

- [ ] 工具栏 RTL 切换按钮（通过 `IUIPartsService` 注册）
- [ ] 右键菜单 "设置文本方向" 选项
- [ ] 快捷键绑定（Ctrl+Shift+X 切换 RTL）
- [ ] 状态栏 RTL 指示器
- [ ] 自动检测开关（基于 cell 内容自动设置方向）

### Phase 5: Sheet 布局 RTL（可选）

- [ ] 评估 Fork vs Transform 方案
- [ ] 列从右到左排列
- [ ] 滚动方向镜像
- [ ] 行号右侧显示

---

## 七、关键文件索引

### 项目文件

| 文件 | 用途 |
|------|------|
| `src/rtl-plugin.ts` | 插件入口，注册所有 Controller |
| `src/controllers/rtl-css.controller.ts` | UI 框架 RTL CSS 注入 |
| `src/controllers/rtl-ui.controller.ts` | UI 工具栏/菜单集成（待重构） |
| `src/controllers/rtl-render.controller.ts` | Cell 渲染 RTL（待创建） |
| `src/commands/toggle-rtl.command.ts` | RTL 切换命令 |
| `src/utils/rtl-detector.ts` | RTL 字符检测工具 |
| `src/utils/bidi-processor.ts` | Bidi 文本视觉重排 |

### Univer 关键文件（依赖分析）

| 文件 | 用途 |
|------|------|
| `@univerjs/core` → `TextDirection` | RTL 枚举值 |
| `@univerjs/core` → `IStyleData.td` | Cell 文本方向字段 |
| `@univerjs/ui` → `ILayoutService` | 根容器 DOM 访问 |
| `@univerjs/ui` → `IUIPartsService` | 组件注入（HEADER_MENU 等） |
| `@univerjs/engine-render` → `IRenderManagerService` | 获取渲染实例 |
| `@univerjs/engine-render` → `Spreadsheet.fontExtension` | Font 扩展 monkey-patch 目标 |
| `@univerjs/engine-render` → `DocumentsSpanAndLineExtensionRegistry` | 文档渲染扩展注册 |
| `@univerjs/engine-render` → `SpreadsheetExtensionRegistry` | Sheet 渲染扩展注册 |
| `@univerjs/engine-render` → `UniverRenderingContext2D.direction` | Canvas 方向属性 |

---

## 八、风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Univer 升级改变 Font 扩展签名 | Monkey-patch 失效 | 版本锁定 + 回归测试 |
| `fontExtension` getter 被移除 | 无法获取实例 | 降级为 docExtension 替换方案 |
| Canvas direction 浏览器支持不一致 | 文本方向错误 | 使用 bidi-js 手动重排替代 |
| 性能影响（逐 cell RTL 检测） | 大表格卡顿 | 缓存检测结果 + 仅检测可视区域 |
| CSS 类名变更 | UI 镜像失效 | 添加 `[class*=""]` 通配选择器作为 fallback |
