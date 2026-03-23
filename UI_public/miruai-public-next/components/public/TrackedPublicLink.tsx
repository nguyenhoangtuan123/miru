"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { trackPublicEvent, type PublicEventPayload } from "../../lib/public-events";

type TrackedPublicLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  event: PublicEventPayload;
};

export function TrackedPublicLink({ href, className, children, event }: TrackedPublicLinkProps) {
  const isExternal = /^https?:\/\//i.test(href);

  return (
    isExternal ? (
      <a
        href={href}
        className={className}
        onClick={() => {
          void trackPublicEvent(event);
        }}
      >
        {children}
      </a>
    ) : (
      <Link
        href={href}
        className={className}
        onClick={() => {
          void trackPublicEvent(event);
        }}
      >
        {children}
      </Link>
    )
  );
}
