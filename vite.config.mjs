import { fileURLToPath } from 'node:url'
import { defineConfig } from '../amiweb-front/node_modules/vite/dist/node/index.js'
import vue from '../amiweb-front/node_modules/@vitejs/plugin-vue/dist/index.mjs'

const vueRuntime = fileURLToPath(
  new URL('../amiweb-front/node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url),
)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      vue: vueRuntime,
    },
    dedupe: ['vue'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
})
