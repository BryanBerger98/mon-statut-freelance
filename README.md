# mon-statut-freelance

Free, SEO-first web app that compares French single-owner (*unipersonnel*)
freelance statuses and ranks them by a precise, figures-based fiscal/social
outcome for a given profile. No monetisation — the goal is organic-search
audience.

Built with Astro 5 (static), React 19 islands for the simulator, Tailwind v4 and
a pure-TypeScript calc engine. See [`CLAUDE.md`](./CLAUDE.md) for the full
architecture and working rules.

## Licences

This project is **dual-licensed**, because it bundles two different kinds of work:

| Part | Covers | Licence |
|---|---|---|
| **Source code** | `src/` (Astro/React/TypeScript, the calc engine), config, build tooling | [AGPL-3.0-only](./LICENSE) |
| **Editorial content** | `src/content/**` (guides, glossaire) and `.claude/docs/business/**` | [CC BY 4.0](./LICENSE-CONTENT.md) |

- **Code — AGPL-3.0-only.** You may use, study, modify and redistribute the
  code, but any modified version you **distribute or run as a network service**
  must make its complete source available under the same licence.
- **Content — CC BY 4.0.** You may share and adapt the editorial content, even
  commercially, **as long as you credit** *mon-statut-freelance* (Bryan Berger),
  link to the licence, and indicate changes.

Copyright © 2026 Bryan Berger.

> The figures and explanations are estimates and general information, **not
> personalised legal or tax advice**.
