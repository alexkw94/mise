/**
 * Feature flags.
 *
 * Flags here switch whole surfaces on and off. Code behind a disabled flag
 * stays in the repository, compiled and typechecked — turning a feature back
 * on is a one-line change, not a rewrite.
 */
export const FEATURES = {
  /**
   * "Was koch ich?" — the AI recipe suggestion tab.
   *
   * Switched OFF on request (Aug 2026): the feature is not being pursued for
   * now. Everything it needs is still here and still builds:
   *   - src/components/CookTab.tsx      the screen
   *   - src/app/api/suggest/route.ts    the server-side Claude call
   *   - PANTRY_CHIPS in src/lib/seed.ts the quick-add chips
   *   - AppShell's `adoptSuggestion`    "In meine Rezepte übernehmen"
   *
   * To bring it back: set this to `true`. The tab reappears in the tab bar,
   * the screen mounts, and adopting a suggestion opens the recipe editor
   * prefilled. Nothing else needs touching.
   */
  cookTab: false,
} as const;
