import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            // Resolve the plugin source directly (no build needed)
            '../src': path.resolve(__dirname, '../src'),
        },
    },
    server: {
        port: 3000,
        open: true,
    },
});
