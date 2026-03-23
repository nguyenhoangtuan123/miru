"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { buildAppTherapistConnectUrl } from "../../lib/api";
import { getViewerState, type PublicEventPayload } from "../../lib/public-events";
import { TrackedPublicLink } from "./TrackedPublicLink";

type PublicTherapistActionLinkProps = {
  therapistId: string;
  source?: "article" | "profile_direct_link" | "directory" | "referral" | "therapist_invite";
  sourceArticleSlug?: string;
  entryIntent?: "message" | "therapy";
  returnTo: string;
  className?: string;
  event: PublicEventPayload;
  children: ReactNode;
};

export function PublicTherapistActionLink({
  therapistId,
  source = "profile_direct_link",
  sourceArticleSlug,
  entryIntent = "therapy",
  returnTo,
  className,
  event,
  children,
}: PublicTherapistActionLinkProps) {
  const [href, setHref] = useState(() =>
    buildAppTherapistConnectUrl({
      therapistId,
      source,
      sourceArticleSlug,
      entryIntent,
      returnTo,
    }),
  );

  useEffect(() => {
    const viewer = getViewerState();
    setHref(buildAppTherapistConnectUrl({
      therapistId,
      source,
      sourceArticleSlug,
      entryIntent,
      returnTo,
      anonymousId: viewer.anonymous_id,
      sessionId: viewer.session_id,
    }));
  }, [entryIntent, returnTo, source, sourceArticleSlug, therapistId]);

  const resolvedHref = href || buildAppTherapistConnectUrl({
    therapistId,
    source,
    sourceArticleSlug,
    entryIntent,
    returnTo,
  });

  return (
    <TrackedPublicLink href={resolvedHref} className={className} event={event}>
      {children}
    </TrackedPublicLink>
  );
}
