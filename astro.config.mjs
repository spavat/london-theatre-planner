// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // Islands are client:only, so Vite's startup scan misses their dependencies and re-optimizes
    // mid-session, which breaks already-loaded pages with 504 "Outdated Optimize Dep" in dev.
    optimizeDeps: {
      include: ['cmdk', 'react-day-picker', 'date-fns', 'lucide-react', 'radix-ui', 'cn', 'class-variance-authority'],
    },
  },

  adapter: node({
    mode: 'standalone'
  })
});