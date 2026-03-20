"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { buildClientLoginUrl, buildPublicContentLoginUrl } from "../../lib/api";
import { getViewerState, type PublicEventPayload } from "../../lib/public-events";
import { TrackedPublicLink } from "./TrackedPublicLink";

type PublicLoginUpliftLinkProps = {
  returnTo: string;
  event: PublicEventPayload;
  className?: string;
  children: ReactNode;
};

export function PublicLoginUpliftLink({
  returnTo,
  event,
  className,
  children,
}: PublicLoginUpliftLinkProps) {
  const [href, setHref] = useState(() =>
    returnTo.startsWith("/") ? buildClientLoginUrl(returnTo) : buildClientLoginUrl("/chat"),
  );

  useEffect(() => {
    const viewer = getViewerState();
    setHref(
      buildPublicContentLoginUrl({
        returnTo,
        anonymousId: viewer.anonymous_id,
        sessionId: viewer.session_id,
      }),
    );
  }, [returnTo]);

  return (
    <TrackedPublicLink href={href} className={className} event={event}>
      {children}
    </TrackedPublicLink>
  );
}
