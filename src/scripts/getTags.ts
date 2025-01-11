import type { AnyEntryMap, CollectionEntry } from "astro:content";

export const getTags = <T extends CollectionEntry<keyof AnyEntryMap>>(
  _data: T[],
): string[] => {
  const tags = new Set<string>();

  const data = _data.filter((item) => item.data?.tags);

  for (const item of data) {
    for (const tag of item.data.tags as string[]) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
};
