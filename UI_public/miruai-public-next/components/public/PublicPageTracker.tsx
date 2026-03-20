"use client";

import { useEffect, useRef } from "react";

import { trackPublicEvent } from "../../lib/public-events";

type PublicPageTrackerProps = {
  articleSlug?: string;
  therapistId?: string;
  topicTags?: string[];
  initialEventType: string;
  enableReadDepth?: boolean;
};

const DEPTH_STEPS = [25, 50, 75, 100];

export function PublicPageTracker({
  articleSlug,
  therapistId,
  topicTags,
  initialEventType,
  enableReadDepth = false,
}: PublicPageTrackerProps) {
  const trackedDepths = useRef<Set<number>>(new Set());

  useEffect(() => {
    void trackPublicEvent({
      event_type: "page_view",
      article_slug: articleSlug ?? null,
      therapist_id: therapistId ?? null,
      topic_tags: topicTags ?? [],
    });

    void trackPublicEvent({
      event_type: initialEventType,
      article_slug: articleSlug ?? null,
      therapist_id: therapistId ?? null,
      topic_tags: topicTags ?? [],
    });
  }, [articleSlug, initialEventType, therapistId, topicTags]);

  useEffect(() => {
    if (!enableReadDepth || !articleSlug) {
      return;
    }

    function handleScroll() {
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const totalScrollable = Math.max(documentHeight - viewportHeight, 1);
      const percent = Math.min(100, Math.round(((scrollTop + viewportHeight) / totalScrollable) * 100));

      for (const step of DEPTH_STEPS) {
        if (percent >= step && !trackedDepths.current.has(step)) {
          trackedDepths.current.add(step);
          void trackPublicEvent({
            event_type: "article_read_depth",
            article_slug: articleSlug,
            topic_tags: topicTags ?? [],
            read_depth_percent: step,
          });
        }
      }
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [articleSlug, enableReadDepth, topicTags]);

  return null;
}
