// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [react()],

  security: {
    // In production the app is only reachable through Traefik, which sets X-Forwarded-Host to the routed
    // domain. Trusting it lets the CSRF origin check accept POSTs (e.g. "Run scrape") made on that domain.
    allowedDomains: [{}],
  },

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