import type { MetadataRoute } from "next";

import { SITE_URL } from "../lib/api";
import { getPublicArticles, getPublicTherapists } from "../lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, therapists] = await Promise.all([
    getPublicArticles({ limit: 100 }),
    getPublicTherapists(100)
  ]);

  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${SITE_URL}/bai-viet`,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: `${SITE_URL}/therapists`,
      changeFrequency: "daily",
      priority: 0.9
    },
    ...articles.map((article) => ({
      url: `${SITE_URL}/bai-viet/${article.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8
    })),
    ...therapists.map((therapist) => ({
      url: `${SITE_URL}/therapists/${therapist.therapist_id}`,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  ];
}
