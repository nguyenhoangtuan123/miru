"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { APP_URL, buildClientLoginUrl, buildPublicContentLoginUrl } from "../../lib/api";
import { getAuthStage, subscribeToPublicAuth } from "../../lib/public-auth";
import { getViewerState, type PublicEventPayload } from "../../lib/public-events";
import { TrackedPublicLink } from "./TrackedPublicLink";

type PublicLoginUpliftLinkProps = {
  returnTo: string;
  event: PublicEventPayload;
  className?: string;
  children: ReactNode;
  /** Optional: label to show if user is already a client (default: children) */
  clientLabel?: ReactNode;
  /** Optional: label to show if user is a therapist */
  therapistLabel?: ReactNode;
  /** Optional: href to use for logged-in client (default: returnTo in app) */
  clientHref?: string;
};

export function PublicLoginUpliftLink({
  returnTo,
  event,
  className,
  children,
  clientLabel,
  therapistLabel,
  clientHref,
}: PublicLoginUpliftLinkProps) {
  const [stage, setStage] = useState<"anonymous" | "client" | "therapist">("anonymous");
  const [href, setHref] = useState(() =>
    returnTo.startsWith("/") ? buildClientLoginUrl(returnTo) : buildClientLoginUrl("/chat"),
  );
  const refreshStage = useCallback(() => {
    const currentStage = getAuthStage();
    setStage(currentStage);

    if (currentStage === "anonymous") {
      const viewer = getViewerState();
      setHref(
        buildPublicContentLoginUrl({
          returnTo,
          anonymousId: viewer.anonymous_id,
          sessionId: viewer.session_id,
        }),
      );
      return;
    }

    if (currentStage === "client") {
      setHref(clientHref || `${APP_URL}/chat`);
      return;
    }

    setHref(`${APP_URL}/therapist/articles`);
  }, [clientHref, returnTo]);

  useEffect(() => {
    refreshStage();
    return subscribeToPublicAuth(refreshStage);
  }, [refreshStage]);

  // Anonymous: show login prompt as before
  if (stage === "anonymous") {
    return (
      <TrackedPublicLink href={href} className={className} event={event}>
        {children}
      </TrackedPublicLink>
    );
  }

  // Client: direct link to action, no login needed
  if (stage === "client") {
    return (
      <a href={href} className={className} style={{ textDecoration: "none" }}>
        {clientLabel || children}
      </a>
    );
  }

  // Therapist: show therapist-appropriate action
  return (
    <a href={href} className={className} style={{ textDecoration: "none" }}>
      {therapistLabel || "Viết bài"}
    </a>
  );
}
