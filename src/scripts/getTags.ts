import type { CollectionEntry, AnyEntryMap } from "astro:content";

export const getTags = <T extends CollectionEntry<keyof AnyEntryMap>>(
  data: T[],
): string[] => {
  const tags = new Set<string>();

  data = data.filter((item) => item.data && item.data.tags);

  data.forEach((item) => {
    item.data.tags!.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags);
};
