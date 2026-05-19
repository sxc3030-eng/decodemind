import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GRAMMAR_REGISTRY } from './registry';

const require = createRequire(import.meta.url);

export function copyGrammarsPlugin(): Plugin {
  return {
    name: 'decodemind-copy-grammars',
    buildStart() {
      const publicDir = path.resolve(
        fileURLToPath(new URL('../../../public', import.meta.url)),
      );
      fs.mkdirSync(publicDir, { recursive: true });
      for (const { language, packagePath } of GRAMMAR_REGISTRY) {
        try {
          const src = require.resolve(packagePath);
          const dst = path.join(publicDir, `tree-sitter-${language}.wasm`);
          fs.copyFileSync(src, dst);
          // eslint-disable-next-line no-console
          console.log(`[grammars] copied ${language} -> public/tree-sitter-${language}.wasm`);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[grammars] missing ${language}: ${(err as Error).message}`);
        }
      }
    },
  };
}
