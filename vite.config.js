import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // REST API сервера (C/api)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // WebSocket-соединение для real-time синхронизации досок
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
