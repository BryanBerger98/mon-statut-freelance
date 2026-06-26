# mon-statut-freelance

Free, **SEO-first** web app that compares French **single-owner (unipersonnel) freelance statuses** and ranks them by a precise, figures-based fiscal/social outcome for a given profile. No monetisation — the goal is organic-search audience.

## Product
- **Job to be done:** free simulator — the user enters figures (CA, real costs, household situation) and gets a **numerically ranked** comparison of statuses. No guided onboarding.
- **Audience:** general public, mixed level. Plain French by default, technical detail on demand (progressive disclosure).
- **Outputs:** (1) figures ranking (*net disponible*), (2) argued recommendation, (3) setup path, (4) evolution simulation, (5) switch cost/benefit.
- **Reference fiscal year:** 2026. Numbers live only in the barèmes registry (`.claude/docs/business/baremes-registry.md`) → mirrored in `src/domain/constants.ts`; refresh via the `regulatory-diff` skill.

## Scope — 7 statuses (single-owner, France)
`micro-entreprise` · `ei-reel` · `eurl-ir` · `eurl-is` · `sasu-ir` · `sasu-is` · `portage-salarial`. No multi-partner forms (no SAS/SARL).

## Stack
- **Single Astro 5 app**, `output: 'static'` (SSG) — no SSR, no API routes. Static HTML is the SEO foundation.
- **React 19 islands** — only the interactive **simulator** hydrates (`client:*`); everything else is zero-JS Astro.
- **Tailwind v4** (CSS-first `@theme` in `src/styles/global.css`, no `tailwind.config.ts`) + **shadcn/ui** (`src/components/ui/`) + lucide-react.
- **Content:** MDX via Astro Content Collections (guides, glossaire) — no CMS.
- **Calc engine:** pure TypeScript in `src/domain/` — framework-agnostic, Vitest-tested against the `test-fixtures` personas.
- **TypeScript strict** (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESM only. **Biome** (lint+format; single quotes, semicolons, width 140). **Zod** at every boundary.
- **pnpm 10**, Node ≥ 24. **Vitest** for units + calc fixtures.

## Repo layout
```
src/
  pages/              # routes only (.astro); getStaticPaths for dynamic
  layouts/            # BaseLayout + <Seo> head component
  components/
    ui/               # shadcn primitives — props in, markup out, no business logic
    *.astro           # static chrome (header, footer)
  features/
    simulator/        # the interactive React island (questionnaire -> ranking)
  domain/             # PURE calc engine — never imports React/Astro  (see rules/calc.md)
    constants.ts      # barèmes, in code — the ONLY place numbers live
    validation.ts     # Zod: profile input, result output
    statuses/         # one calc module per status, same signature
    __tests__/        # fixtures-driven Vitest (from the test-fixtures skill)
  content.config.ts   # Zod-validated content collections (v5: at src/ root)
  content/            # MDX: guides/, glossaire/
  lib/                # generic, domain-agnostic utils & hooks (useUrlParam…)
  styles/global.css   # Tailwind v4 @theme
.claude/
  agents/             # 4 design-time domain experts (consult, never shipped)
  skills/             # 5 design-time deliverable skills (the procedures)
  rules/              # path-scoped authoring rules (read before editing)
  docs/business/      # ALL business deliverables (the skills' outputs):
    baremes-registry.md   #   single source of truth for numbers
    regulatory/           #   regulatory-diff update notes
    statuses/             #   status-reference fiches
    calculation/          #   calculation-spec outputs
    product/              #   product-spec
```

## Commands
```bash
pnpm install
pnpm dev          # astro dev
pnpm build        # astro build (static -> dist/)
pnpm preview      # serve dist/ locally
pnpm lint         # biome check .
pnpm lint:fix     # biome check --write .
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run (units + calc fixtures)
pnpm test:watch
```

## Hosting & deploy
Static `dist/` served by **Caddy** (`file_server`) in a Docker Compose stack on a **Scaleway Instance** (`fr-par-1`), TLS via Let's Encrypt managed by Caddy. Deploy through a GitHub Actions workflow: rsync `dist/` over SSH into the server's `www/` — Caddy serves new files on the next request, no reload. (Same model as brand-icons.)

## SEO — first-class (see `.claude/rules/seo.md`)
Static-rendered content, one canonical URL per page, `@astrojs/sitemap`, JSON-LD structured data (WebApplication, FAQPage, Article, BreadcrumbList), OpenGraph, single semantic `<h1>`, tight island boundary for Core Web Vitals, internal linking guides ↔ simulator. Content strategy: **editorial (guides + glossaire) + the simulator** — no programmatic page generation for now.

## Design-time experts (`.claude/agents` + `.claude/skills`) — never shipped to users
Domain Product Owners you consult while building. Their outputs are **dev-facing specs**, never runtime code or user copy.

| Agent | Consult for |
|---|---|
| `legal-status-analyst` | legal characterisation, cross-status comparison, edge cases, creation formalities, disclaimers |
| `tax-social-modeler` | exact contribution/tax formulas and order, IR/IS/dividend arbitrage — what to code |
| `product-owner` | questionnaire, comparison criteria & scoring, results/evolution/switch UX, copy strategy |
| `regulatory-watcher` | what changed this year and where it impacts the code (sourced, dated values) |

| Skill | Produces |
|---|---|
| `status-reference` | one standardized fact sheet per status (incl. its setup path) |
| `calculation-spec` | the deterministic *net-after-everything* calc spec, TS-transcription-ready |
| `test-fixtures` | profile → expected-result reference cases to validate the hand-coded calc |
| `product-spec` | questionnaire + criteria/scoring + results / evolution / switch UX spec |
| `regulatory-diff` | annual update note + the **barèmes registry** (single source of truth for numbers) |

## Rules (`.claude/rules/`)
Path-scoped — read before editing matching files. `§1 Must follow` is non-negotiable; `§2 Conventions` is project style.

| File | Applies to |
|---|---|
| `typescript.md` | `**/*.{ts,tsx}` |
| `react.md` | React islands (`src/features/**`, `**/use-*.tsx`) |
| `astro.md` | `src/**/*.{astro,mdx}`, `src/content/**`, `astro.config.*` |
| `components.md` | UI vs business split, shadcn, island boundary |
| `hooks.md` | `**/use-*.ts(x)` |
| `tests.md` | Vitest units + calc fixtures |
| `calc.md` | `src/domain/**` — the fiscal engine: registry, Zod, fixtures, no invented numbers |
| `seo.md` | pages, metadata, structured data, editorial content |
| `commits.md` | git commit messages |

## Working rules (domain)
- **Business docs live in `.claude/docs/business/`.** Every design-time deliverable (barèmes registry, status fiches, calc specs, product spec, regulatory update notes) is written there. `.claude/agents` and `.claude/skills` are the experts and procedures; `.claude/docs/business/` is their output.
- **Mechanics vs values.** Formulas/logic are stable — code them. Numeric rates/thresholds are volatile — they live only in `src/domain/constants.ts`, each with a value, an effective year, and an official source. **Never invent a number** — flag it for `regulatory-watcher`.
- **Calc is hand-maintained & test-guarded.** Calculations are hand-coded TS and updated manually; any calc change must keep `test-fixtures` green (update fixtures only via a sourced `regulatory-diff`).
- **Language.** User-facing copy: **French**. Code, specs, rules, commits: **English**, keeping French domain terms verbatim (`micro-entreprise`, `cotisations`, `abattement`…).
- **Disclaimer.** Every user-facing result is an estimate, not personalised legal or tax advice.

## Documentation lookups
Use **context7** for any library/framework doc lookup (Astro 5, `@astrojs/react`, `@astrojs/sitemap`, Tailwind v4, shadcn/ui, Vitest, Zod) — training data drifts.

## What this project is not
- Not SSR — Astro static; no DB, no auth, no server endpoints. Constants are imported at build time, never fetched at runtime.
- Not a CMS — content is MDX in the repo; adding a guide is a code change.
- Not personalised advice — it is an estimator with explicit assumptions and a disclaimer.
- Not monetised — no affiliate links, no lead-gen funnel (for now).
