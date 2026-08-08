/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Build-time HTML includes. Any index.html may pull in a fragment with
 *   <!-- @include sections/hero/hero.html -->
 * resolved relative to that index.html's own directory. This lets the landing
 * page keep each section's markup in the section's own folder (alongside its
 * CSS and JS) while still shipping one static, no-JS-friendly document — the
 * assembly happens at build/serve time, not in the browser. The app's
 * index.html has no @include markers, so this is a no-op there.
 */
function htmlIncludes(): Plugin {
  const include = (html: string, dir: string, seen: Set<string>): string =>
    html.replace(/<!--\s*@include\s+(\S+?)\s*-->/g, (_m, rel: string) => {
      const file = path.resolve(dir, rel);
      if (seen.has(file)) throw new Error(`html-includes: circular include of ${rel}`);
      const next = new Set(seen).add(file);
      return include(fs.readFileSync(file, 'utf8'), path.dirname(file), next);
    });
  return {
    name: 'html-includes',
    enforce: 'pre',
    transformIndexHtml(html, ctx) {
      return include(html, path.dirname(ctx.filename), new Set([ctx.filename]));
    },
  };
}

export default defineConfig({
  plugins: [htmlIncludes(), react()],
  server: {
    watch: {
      ignored: ['**/*.zip'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@server': fileURLToPath(new URL('./server', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        landing: fileURLToPath(new URL('./landing/index.html', import.meta.url)),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
      'landing/**/*.{test,spec}.ts',
    ],
  },
});
