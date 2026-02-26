# Univer RTL Tools Plugin

`univer-plugin-rtl-tools` is an extension for the [Univer](https://univer.ai) spreadsheet and document platform. It provides a set of UI tools and utilities specifically designed to improve the experience of handling Right-To-Left (RTL) languages such as Arabic, Persian, and Hebrew within Univer.

> **Status:** 🚧 Work in Progress (WIP). This plugin is currently a scaffold and serves as a bridging tool while waiting for deeper RTL layout support in the core Univer rendering engine.

## Features (Planned)

- 🎛 **Toolbar Integration**: Adds a quick-toggle button to the Univer toolbar for switching RTL contexts.
- 🧠 **Smart Detection**: Automatically detects RTL language input (e.g., Arabic/Persian Unicode blocks) in cells and prompts the user to adjust the layout/direction.
- 🌐 **Seamless UI Hooking**: Built on top of Univer's Plugin and Dependency Injection (DI) architecture.

## Installation

```bash
npm install univer-plugin-rtl-tools
```

## Usage

Register the plugin when initializing your Univer instance:

```typescript
import { Univer } from '@univerjs/core';
import { UniverRtlToolsPlugin } from 'univer-plugin-rtl-tools';

const univer = new Univer();

// Register core plugins first...
// univer.registerPlugin(UniverSheetsUIPlugin);

// Register the RTL Tools plugin
univer.registerPlugin(UniverRtlToolsPlugin);
```

## Development

This project uses `tsup` for extremely fast, zero-config bundling.

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start development watch mode:**
   ```bash
   npm run dev
   ```
3. **Build for production:**
   ```bash
   npm run build
   ```

## Architecture

This plugin follows the standard Univer architecture:
- `UniverRtlToolsPlugin`: The main entry point that registers the lifecycle hooks.
- `RtlUIController`: Handles the injection of UI elements (like the toolbar button) using `IMenuManagerService`.
- `ToggleRtlCommand`: The command that executes the state mutation when the UI is interacted with.

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/dreamkidd/univer-plugin-rtl-tools/issues).

## License

[MIT](LICENSE)
