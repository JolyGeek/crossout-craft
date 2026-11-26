import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// В режиме разработки /api проксируется прямо на CrossoutDB.
// В продакшене адрес задаётся переменной VITE_API_BASE (URL Cloudflare Worker).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://crossoutdb.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
    },
  },
});
