/*
 * Small shared pieces for the GitHub section — the eyebrow label, the
 * loading/error/empty notice, and the skeleton block. Keeping them here means
 * every state inside the section speaks with the same voice.
 */

import type { CSSProperties, ReactNode } from "react";

import { DIM, FAINT, INK, MONO, SANS, metaStyle } from "@/lib/theme";

/** A hairline-underlined external link, matching the links in the page header. */
export function QuietLink({
  href,
  children,
  style,
}: {
  href: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        fontFamily: MONO,
        fontSize: 12.5,
        color: DIM,
        textDecoration: "none",
        borderBottom: `1px solid ${FAINT}`,
        ...style,
      }}
    >
      {children}
    </a>
  );
}

/**
 * The single place a failure or an empty result is rendered.
 *
 * It always occupies real space, so a section that fails never collapses into a
 * blank gap, and it never blames the visitor.
 */
export function StateNotice({
  message,
  hint,
  onRetry,
  minHeight = 120,
}: {
  message: string;
  hint?: string;
  onRetry?: () => void;
  minHeight?: number;
}) {
  return (
    <div
      role="status"
      style={{
        minHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "28px 20px",
        textAlign: "center",
        border: `1px dashed ${FAINT}`,
        borderRadius: 4,
      }}
    >
      <p style={{ fontFamily: SANS, fontSize: 14.5, color: INK, margin: 0 }}>{message}</p>
      {hint && <p style={{ ...metaStyle, margin: 0, maxWidth: 380 }}>{hint}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            ...metaStyle,
            marginTop: 4,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            borderBottom: `1px solid ${FAINT}`,
          }}
        >
          try again
        </button>
      )}
    </div>
  );
}

export function Skeleton({
  width,
  height,
  radius = 3,
  style,
}: {
  width?: number | string;
  height: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="gh-shimmer"
      aria-hidden="true"
      style={{ width: width ?? "100%", height, borderRadius: radius, ...style }}
    />
  );
}
