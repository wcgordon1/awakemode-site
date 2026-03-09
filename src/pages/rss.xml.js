import rss, { pagesGlobToRssItems } from "@astrojs/rss";

export async function GET(context) {
  return rss({
    title: "AwakeMode",
    description:
      "Guides, updates, and product notes for keeping your computer awake with browser and extension workflows.",
    site: context.site,
    items: await pagesGlobToRssItems(import.meta.glob("./blog/*.{md,mdx}")),
  });
}
