import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image(),
      heroImageAlt: z.string(),
      draft: z.boolean().default(false),
      keywords: z.array(z.string()).default([]),
      faq: z
        .array(z.object({ q: z.string(), a: z.string() }))
        .default([]),
    }),
});

export const collections = { blog };
