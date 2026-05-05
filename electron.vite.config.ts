import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {},
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: {},
    },
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, './src/renderer/index.html'),
          popup: resolve(__dirname, './src/renderer/popup.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@renderer': resolve('./src/renderer/src'),
      },
    },
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  },
})
