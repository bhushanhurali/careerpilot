# CareerPilot Design System

## Styling Responsibilities

- Use Angular Material 3 for interactive controls, forms, dialogs, menus, tables, and
  progress indicators. Use public theming APIs instead of targeting Material internals.
- Use Tailwind CSS 4 for layout, responsive grids, alignment, and spacing. The
  `src/utilities.css` entry maps shared tokens into utilities and deliberately leaves
  Preflight disabled. Keep class names discoverable in templates.
- Use semantic `--cp-*` tokens from `src/styles/_tokens.scss` for canvas, surfaces,
  text, borders, type, spacing, radii, and shadows. Use paired Material container and
  on-container colors for status badges and feedback; always include a text label.
- Reuse `src/styles/_records.scss` for record headings, filter grids, scrolling tables,
  facts, list rows, badges, and feedback. Keep feature-specific styles local.

## Appearance

Light and Dark override the operating system. System follows the browser's live
`prefers-color-scheme` setting via CSS `color-scheme: light dark`, with no event listener
or reload required. A script in the document head restores the stored
`careerpilot-theme` preference before Angular renders; invalid or blocked storage
falls back to System. The service keeps the color-scheme hint in sync with runtime
changes. Preference is local to this browser and independent of auth.

The document root controls both Material and CareerPilot colors, so overlays attached
to the body inherit the same scheme. When introducing a production CSP, allow the
startup script by hash/nonce or move it to an explicitly allowed blocking asset.

## Interaction Checks

- Keep navigation keyboard-operable, preserve focus indicators, and retain Material
  focus management in dialogs and the compact drawer. Avoid new motion that ignores
  `prefers-reduced-motion`.
- Wrap actions and long values. Keep wide records inside labeled, keyboard-scrollable
  regions rather than causing page-wide overflow or removing sortable columns.
- Use status announcements for loading and success, alerts for actionable errors,
  and distinguish empty data from no filtered matches. Preserve the distinction
  between zero and unavailable coverage. Keep charts understandable without color.
- Check mobile, tablet, and desktop in both themes; switch System appearance without
  reloading, and check menus and dialogs as well as the page behind them.
