import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { marketApiPlugin } from './src/api/devServerPlugin.ts';

// В режиме разработки /api/market отдаёт сам dev-сервер (данные с crossoutcore.ru).
// В продакшене адрес задаётся переменной VITE_API_BASE (URL Cloudflare Worker).
export default defineConfig({
  plugins: [react(), marketApiPlugin()],
});
