"use client";

import type { ReactNode } from "react";
import { Logo } from "./Logo";

/** Height of the tab bar, used to keep scroll content and the FAB clear of it. */
export const TABBAR = "calc(64px + max(var(--safe-bottom), 10px))";

export function Screen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}

export function ScreenHeader({
  kicker,
  title,
  trailing,
  children,
}: {
  /** Small uppercase line, right of the wordmark on the brand row. */
  kicker?: string;
  title: string;
  /** Right-aligned counter on the title baseline. */
  trailing?: string;
  /** Search field or similar, rendered below the title. */
  children?: ReactNode;
}) {
  return (
    <header className="mlk-header flex-none">
      {/* Brand row: the wordmark is on every main screen, sharing the line
          with the screen's kicker so it costs no extra height. */}
      <div className="flex items-center justify-between gap-3">
        <Logo />
        {kicker && <span className="mlk-kicker">{kicker}</span>}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h1 className="mlk-title">{title}</h1>
        {trailing && (
          <span
            style={{
              font: "400 12.5px/1 var(--font-sans)",
              color: "var(--color-subtle)",
            }}
          >
            {trailing}
          </span>
        )}
      </div>
      {children}
    </header>
  );
}

export function ScreenScroll({
  children,
  extraBottom = 90,
}: {
  children: ReactNode;
  /** Room for the floating action button, on top of the tab-bar clearance. */
  extraBottom?: number;
}) {
  return (
    <div
      className="mlk-scroll min-h-0 flex-1 overflow-y-auto px-[22px] pt-[18px]"
      style={{ paddingBottom: `calc(${TABBAR} + ${extraBottom}px)` }}
    >
      {children}
    </div>
  );
}
