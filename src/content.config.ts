import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(20).max(200),
    /** Publication / last-update date (ISO string). */
    updated: z.string().optional(),
  }),
});

const glossaire = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/glossaire' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(10).max(200),
    /** Publication / last-update date (ISO string). */
    updated: z.string().optional(),
  }),
});

export const collections = { guides, glossaire };
