import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:3000', '/ws': { target: 'ws://127.0.0.1:3000', ws: true } } },
  build: {
    outDir: 'dist', sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined;
          if (/\/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) return 'react';
          if (id.includes('/node_modules/antd/')) return 'antd';
          if (/\/node_modules\/(@ant-design\/plots|@antv\/)/.test(id)) return 'charts';
          if (/\/node_modules\/(antd-mobile|antd-mobile-icons)\//.test(id)) return 'mobile';
          if (/\/node_modules\/(rc-|@rc-component\/|@ant-design\/)/.test(id)) return 'ui-runtime';
          return 'vendor';
        },
      },
    },
  },
});
