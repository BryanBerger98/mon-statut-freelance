/**
 * JSON-LD structured-data builders (seo.md §1.4).
 *
 * Build typed schema.org objects here; pages serialise them via `<Seo jsonLd={...} />`,
 * which emits `<script type="application/ld+json">` into the static HTML at build time.
 * Never concatenate JSON strings by hand, and never emit JSON-LD from a React island —
 * it must be present in the server-rendered HTML for crawlers.
 */

/** A schema.org node, serialised into a single `<script type="application/ld+json">` tag. */
export type JsonLd = Record<string, unknown>;

const CONTEXT = 'https://schema.org';
const SITE_NAME = 'Mon statut freelance';

/** Organization node reused as author/publisher across editorial nodes. */
const ORGANIZATION = { '@type': 'Organization', name: SITE_NAME } as const;

export type WebApplicationInput = {
  name: string;
  description: string;
  /** Absolute canonical URL of the simulator page. */
  url: string;
};

/** `WebApplication` — the free simulator (seo.md §1.4). */
export const webApplicationLd = ({ name, description, url }: WebApplicationInput): JsonLd => ({
  '@context': CONTEXT,
  '@type': 'WebApplication',
  name,
  description,
  url,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  inLanguage: 'fr-FR',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  publisher: ORGANIZATION,
});

export type FaqItem = { q: string; a: string };

/** `FAQPage` — qualitative question/answer blocks (seo.md §1.4). */
export const faqPageLd = (items: readonly FaqItem[]): JsonLd => ({
  '@context': CONTEXT,
  '@type': 'FAQPage',
  mainEntity: items.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
});

export type ArticleInput = {
  headline: string;
  description: string;
  /** Absolute canonical URL of the article. */
  url: string;
  /** ISO date (YYYY-MM-DD); used for both publication and last-modified when present. */
  updated?: string | undefined;
};

/** `Article` — editorial guides and glossary entries (seo.md §1.4). */
export const articleLd = ({ headline, description, url, updated }: ArticleInput): JsonLd => ({
  '@context': CONTEXT,
  '@type': 'Article',
  headline,
  description,
  url,
  inLanguage: 'fr-FR',
  author: ORGANIZATION,
  publisher: ORGANIZATION,
  ...(updated ? { datePublished: updated, dateModified: updated } : {}),
});

/** One breadcrumb. The current page is the last crumb and carries no `url`. */
export type Crumb = { name: string; url?: string | undefined };

/** `BreadcrumbList` — navigation trail with absolute item URLs (seo.md §1.4). */
export const breadcrumbLd = (crumbs: readonly Crumb[]): JsonLd => ({
  '@context': CONTEXT,
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    ...(crumb.url ? { item: crumb.url } : {}),
  })),
});

/**
 * Serialise a JSON-LD node for inlining inside a `<script>` tag.
 * Escapes `<` so the payload can never break out of the script element.
 */
export const serializeJsonLd = (node: JsonLd): string => JSON.stringify(node).replace(/</g, '\\u003c');
