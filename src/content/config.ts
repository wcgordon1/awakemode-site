import { defineCollection, z } from "astro:content";
const team = defineCollection({
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      intro: z.string(),
      education: z.array(z.string()),
      experience: z.array(z.string()),
      avatar: z.object({
        url: image(),   
        alt: z.string(),
      }),
    }),
});
const services = defineCollection({
  schema: z.object({
    service: z.string(),
    description: z.string(),
  }),
});
const work = defineCollection({
  schema: ({ image }) =>
    z.object({
      launchDate: z.date(),
      client: z.string(),
      work: z.string(),
      description: z.string(),
      logo: z.object({
        url: image(),   
        alt: z.string(),
      }),
    }),
});
const legal = defineCollection({
  schema: z.object({
    page: z.string(),
    pubDate: z.date(),
  }),
});
const posts = defineCollection({
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      pubDate: z.date(),
      description: z.string(),
      image: z.object({
        url: image(),   
        alt: z.string(),
      }),
      tags: z.array(z.string()),
    }),
});
export const collections = {
  team,
  services,
  work,
  legal,
  posts,
};
