import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { copyGrammarsPlugin } from './src/lib/grammars/copyGrammarsPlugin';

/** Read package.json version + current git short hash at build time. */
function buildInfo(): { version: string; commit: string; built: string } {
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'));
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // Not a git checkout (e.g. CI without git). Fine — keep 'unknown'.
  }
  return { version: pkg.version, commit, built: new Date().toISOString().slice(0, 16) + 'Z' };
}

const APP_BUILD = buildInfo();

// Required for WebGPU + SharedArrayBuffer (WebLLM) on both dev and preview servers.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  define: {
    // Inject build metadata as compile-time constants. Reachable via
    // `import.meta.env.VITE_APP_VERSION` / `VITE_APP_COMMIT` / `VITE_APP_BUILT`.
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_BUILD.version),
    'import.meta.env.VITE_APP_COMMIT':  JSON.stringify(APP_BUILD.commit),
    'import.meta.env.VITE_APP_BUILT':   JSON.stringify(APP_BUILD.built),
  },
  plugins: [
    // wasm + topLevelAwait support `@ast-grep/wasm` which imports `wasm_bg.wasm`
    // via JS module syntax. Required since V2.1 wired the ast-grep worker.
    wasm(),
    topLevelAwait(),
    react(),
    copyGrammarsPlugin(),
    VitePWA({
      // 'prompt' sans interface pour poser la question laissait le nouveau
      // service worker « en attente » pour toujours. Un visiteur deja venu
      // reclamait alors d'anciens fichiers ; Cloudflare Pages repond la
      // coquille de l'application, du HTML en 200, pour toute adresse
      // inconnue. Le navigateur recevait du HTML la ou il attendait du
      // JavaScript : page blanche, sans message et sans recours.
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // 12 MB — accommodates ruff WASM blob (~10.6 MB)
        // Sans ca, les anciens paquets restent en cache et continuent d'etre
        // servis apres une mise a jour.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Une requete vers /assets/ attend un fichier, jamais une page. Si le
        // fichier n'existe plus, il vaut mieux un 404 franc que la coquille
        // HTML servie en silence : c'est elle qui produit la page blanche.
        navigateFallbackDenylist: [/^\/assets\//, /^\/img\//, /\.[a-z0-9]+$/i],
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
