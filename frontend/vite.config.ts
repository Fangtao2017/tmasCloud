import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.BACKEND_URL || 'http://127.0.0.1:3000'

  return {
    plugins: [react()],
    server: {
      port: 3001,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: 'localhost',
        },
        '/auth': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: 'localhost',
        },
      },
    },
  }
})
