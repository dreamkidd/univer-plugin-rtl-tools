# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Univer spreadsheet plugin that adds RTL (Right-to-Left) text support — toolbar toggle, automatic RTL language detection, and bidirectional text reordering via the Unicode Bidi Algorithm. Currently WIP/scaffold while waiting for deeper RTL layout support in the core Univer rendering engine.

## Commands

- `npm run build` — production build via tsup (outputs CJS + ESM + .d.ts to `dist/`)
- `npm run dev` — watch mode for development
- `npm run lint` — type-check only (`tsc --noEmit`), no linter like ESLint is configured
- No test framework is set up yet

## Architecture

This plugin follows the standard Univer plugin pattern (DI-based, lifecycle-driven):

**Entry flow:** `UniverRtlToolsPlugin.onStarting()` registers DI dependencies → `onReady()` instantiates `RtlUIController` → controller registers commands, menus, and cell-edit listeners.

Key modules:

- **`src/rtl-plugin.ts`** — Plugin class (`PluginType.Sheet`). Registers `RtlUIController` into the Univer DI container.
- **`src/controllers/rtl-ui.controller.ts`** — Wires up toolbar menu item, registers `ToggleRtlCommand`, and listens to `sheet.mutation.set-range-values` to auto-detect RTL input in cells.
- **`src/commands/toggle-rtl.command.ts`** — Stub command (`sheet.command.toggle-rtl`). Currently placeholder pending core engine direction API.
- **`src/utils/rtl-detector.ts`** — Pure functions: `hasRTLCharacters`, `getRTLPercentage`, `isRTLDominant` (threshold-based). Uses Unicode range `\u0591-\u07FF`, `\uFB1D-\uFDFD`, `\uFE70-\uFEFC`.
- **`src/utils/bidi-processor.ts`** — `getVisualTextRuns()` uses `bidi-js` to split logical text into visual `TextRun[]` segments for Canvas rendering. Each run has text, direction, and embedding level.

## Key Dependencies

- **`@univerjs/core`** and **`@univerjs/ui`** — peer dependencies; externalized in the bundle. Uses Univer's DI decorators (`@Inject`, `@OnLifecycle`), command system (`ICommandService`), and menu system (`IMenuManagerService`).
- **`bidi-js`** — runtime dependency implementing the Unicode Bidirectional Algorithm.

## TypeScript Config Notes

- `experimentalDecorators` and `emitDecoratorMetadata` are enabled (required by Univer DI).
- Strict mode with `noUnusedLocals` and `noUnusedParameters`.
