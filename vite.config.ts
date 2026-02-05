import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // 開発時: /api/* へのリクエストをローカルのサーバーレス関数にプロキシ
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
    // APIキーはサーバー側で管理するため、クライアントへの露出を削除
    // define: {
    //   'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    // },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
