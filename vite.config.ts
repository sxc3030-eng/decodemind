import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import { copyGrammarsPlugin } from './src/lib/grammars/copyGrammarsPlugin';

// Required for WebGPU + SharedArrayBuffer (WebLLM) on both dev and preview servers.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [
    react(),
    copyGrammarsPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
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
  },
  server: {
    headers: crossOriginIsolationHeaders,
    open: true, // auto-open default browser on dev start
  },
  preview: {
    headers: crossOriginIsolationHeaders,
    open: true,
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', '@ast-grep/wasm', '@astral-sh/ruff-wasm-web'],
  },
});
