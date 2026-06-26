import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';

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
  // Self-hosted Umami (cookieless analytics). Public, build-time-inlined values —
  // optional so dev/preview builds without them simply emit no tracking script.
  // Set in CI via GitHub Actions `vars` (see .github/workflows/deploy.yml) and
  // locally via .env (see .env.example).
  env: {
    schema: {
      PUBLIC_UMAMI_SRC: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_UMAMI_WEBSITE_ID: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },
  integrations: [react(), sitemap(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
