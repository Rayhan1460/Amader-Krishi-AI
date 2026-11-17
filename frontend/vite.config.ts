import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND_TARGET = process.env.VITE_BACKEND_PROXY_TARGET || process.env.BACKEND_URL || 'http://127.0.0.1:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/produce-market': { target: BACKEND_TARGET, changeOrigin: true },
      '/auth': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/models': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/predict': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/chat': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/history': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/farm-hub': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/farms': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/crops': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/weather': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/calendar': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/soil': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/health': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/openapi.json': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/docs': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
    },
  },
})
