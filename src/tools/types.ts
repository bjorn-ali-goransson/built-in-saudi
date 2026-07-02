import type { ComponentType, LazyExoticComponent } from 'react'

export type ToolStatus = 'stable' | 'beta' | 'coming-soon'

export interface ToolIconProps {
  className?: string
}

/**
 * A Tool is a self-contained, pluggable unit. To add a tool:
 *   1. Create `src/tools/<id>/` with a `<Name>Tool.tsx` (default export) and a `meta.ts`.
 *   2. Export a `Tool` object from `meta.ts` with a lazy `component`.
 *   3. Register it in `src/tools/index.ts`.
 * The shell (routing, home catalog, tool page, SEO) picks it up automatically.
 *
 * A tool may also be "external" — omit `component` and set `href` to showcase a
 * tool that lives outside this app. The catalog links out instead of routing in.
 */
export interface Tool {
  /** URL slug, e.g. "qr-code" → /tools/qr-code */
  id: string
  name: string
  /** Arabic name, shown as a bilingual accent where space allows. */
  nameAr?: string
  /** One-line hook for cards. */
  tagline: string
  /** Fuller description for the tool page header + SEO. */
  description: string
  category: string
  keywords: string[]
  status: ToolStatus
  Icon: ComponentType<ToolIconProps>
  /** Internal tool: the lazily-loaded React component rendered at /tools/:id. */
  component?: LazyExoticComponent<ComponentType>
  /** External tool: link out instead of routing in. */
  href?: string
  /** Arabic translations of the display fields (category is translated centrally). */
  ar?: { name: string; tagline: string; description: string }
}
