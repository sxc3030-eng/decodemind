import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { copyGrammarsPlugin } from './src/lib/grammars/copyGrammarsPlugin';

// Required for WebGPU + SharedArrayBuffer (WebLLM) on both dev and preview servers.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [
    // wasm + topLevelAwait support `@ast-grep/wasm` which imports `wasm_bg.wasm`
    // via JS module syntax. Required since V2.1 wired the ast-grep worker.
    wasm(),
    topLevelAwait(),
    react(),
    copyGrammarsPlugin(),
    VitePWA({
      registerType: 'prompt',
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // 12 MB — accommodates ruff WASM blob (~10.6 MB)
        runtimeCaching: [
          {
            // Hugging Face model weights
            urlPattern: /^https:\/\/huggingface\.co\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'huggingface-models',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'DecodeMind',
        short_name: 'DecodeMind',
        description: 'Privacy-first code scanner running in your browser.',
        theme_color: '#2563EB',
        background_color: '#0F172A',
        display: 'standalone',
        icons: [], // V1 launch will add real icons
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
    // Workers need the same wasm + top-level-await transform — the ast-grep
    // worker imports `@ast-grep/wasm` which uses ESM-WASM integration.
    plugins: () => [wasm(), topLevelAwait()],
  },
  server: {
    headers: crossOriginIsolationHeaders,
    open: true, // auto-open default browser on dev start
  },
  preview: {
    headers: crossOriginIsolationHeaders,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // @mlc-ai/web-llm, @ast-grep/wasm, @astral-sh/ruff-wasm-web are WASM-heavy and
          // loaded dynamically at runtime — they are kept out of the bundle via optimizeDeps.exclude.
          // Only JS-bundleable deps are split here.
          'prettier': ['prettier/standalone', 'prettier/plugins/babel', 'prettier/plugins/estree', 'prettier/plugins/typescript', 'prettier/plugins/html', 'prettier/plugins/postcss'],
          'eslint': ['eslint-linter-browserify'],
        },
      },
    },
    chunkSizeWarningLimit: 6000, // intentionally large for linter + WASM payloads
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', '@ast-grep/wasm', '@astral-sh/ruff-wasm-web'],
  },
});
