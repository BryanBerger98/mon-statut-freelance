import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Production domain — drives sitemap + canonical. The alias monstatutfreelance.fr
  // (no hyphens) 301-redirects here at the Caddy layer; it never appears in canonical
  // or sitemap URLs.
  site: 'https://mon-statut-freelance.fr',
  // Single trailing-slash policy: every internal link and canonical ends with `/`,
  // matching the directory build output (`/comparateur/index.html`). Caddy 301s the
  // slashless form. Keep internal hrefs in sync — see header/footer/pages.
  trailingSlash: 'always',
  output: 'static',
  integrations: [react(), sitemap(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
