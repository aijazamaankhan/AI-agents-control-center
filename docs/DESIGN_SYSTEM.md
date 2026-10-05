# Design System — v2 "Signal"

Direction: **enterprise AI infrastructure with a live-operations feel** — near-black
surfaces, one signal-green primary, a small set of neon accents used for meaning, big
condensed numerals, and motion that represents real activity (events flowing), never
decoration.

## Research & references

- Node-graph editors (n8n-style canvases): dotted canvas, nodes joined by curved edges,
  labelled ports → the **workforce map**.
- Folder-tab widgets with oversized condensed numerals → **KPI widgets**.
- Input → Process → Review → Execute agent pipeline → the **execution trace** stepper and
  the "How it works" steps.
- 2026 observability/agent dashboards: dark mode, glow on _active_ paths only,
  semi-transparent node borders, flowing SVG connections, pulsing working nodes.
- Accessibility: off-white text (not pure white) on near-black; ≥4.5:1 text contrast;
  WCAG 2.2.2 requires pause/stop for motion longer than 5 s; honour
  `prefers-reduced-motion`.

## Tokens (`src/app/globals.css` → Tailwind utilities)

| Token                      | Value                 | Use                                          |
| -------------------------- | --------------------- | -------------------------------------------- |
| `background`               | `#050607`             | App background                               |
| `surface`                  | `#0B0D0F`             | Cards, sidebar, widgets                      |
| `raised`                   | `#121518`             | Inputs, chips, hover                         |
| `elevated`                 | `#181C20`             | Hover on raised                              |
| `border` / `border-strong` | `#1F2428` / `#2C3237` | Dividers / idle edges, scrollbar thumb       |
| `primary`                  | `#3CF08A`             | Primary actions, focus, **working**, success |
| `lime`                     | `#D4FF3F`             | Cost                                         |
| `cyan`                     | `#38D9F5`             | Tokens / info                                |
| `purple`                   | `#A78BFA`             | Models / LLM calls                           |
| `orange`                   | `#FF7A2F`             | Anthropic badge, accent                      |
| `pink`                     | `#FF4D8D`             | Accent                                       |
| `warning`                  | `#FFB020`             | **Needs approval** / waiting                 |
| `error`                    | `#FF4D5E`             | **Failed**                                   |
| `foreground`               | `#EEF3F0`             | Text                                         |
| `muted`                    | `#8B958F`             | Secondary text (≈6:1 on surface)             |

Text on `primary` buttons is `background` (dark), not white.

## Type

- **Inter** for UI text; **Barlow Condensed** (`font-display`) for KPI numerals and stats.
- `tabular-nums` for every changing number; mono for IDs, timestamps, token counts.

## Shape

- Widgets 22px (`rounded-widget`), cards 16px (`rounded-card`), controls 10px.
- KPI widgets use the folder-tab notch (tab + concave joint, no border).

## Motion (`@theme` keyframes)

| Utility              | Use                                                                           |
| -------------------- | ----------------------------------------------------------------------------- |
| `animate-flow-dash`  | Dashed edge flowing toward the hub when a path is active                      |
| `animate-pulse-ring` | Halo behind working agents and the hub core                                   |
| `animate-blink`      | Live dots, current trace step                                                 |
| `animate-rise`       | New activity-feed items                                                       |
| SVG `animateMotion`  | Event packets travelling along edges (only while not paused / reduced-motion) |

Rules: only active things move; the pause button stops everything; reduced motion
disables all animation via the global media query and stops packets.

## Department colours & icons

Departments are user-created and unbounded, so their accent and icon are **derived**
(`src/features/workforce/visuals.ts`): accent cycles through the six accents by lane
index (hash of the name when no index), icon is guessed from the name with a building
fallback.

## Components

`Button`, `Card`, `Input`/`Select`/`FormField`, `Badge`, `StatusIndicator`, `EmptyState`,
`ErrorState`, `Skeleton`, `FormMessage`, `Folder` (`src/components/ui`); `KpiCard`
(dashboard); `WorkforceMap`, `MapCanvas`, `DetailPanel`, `ActivityFeed`
(`src/features/workforce/components`).

## Folders (KPI row) and titled panels

The **KPI row at the top of each page** is drawn as realistic file folders (`<Folder
variant="folder">`, styles in `globals.css` → `.folder*`):

- **Back cover** tinted with the metric's colour (`--folder-accent`). Its label tab carries
  the metric name and has a slanted shoulder.
- A lined **sheet of paper** shows between the covers.
- The **front cover** is about 156px tall, with large numerals, an accent underline and a
  caption at the bottom.
- On hover or focus the paper lifts and the front tips open slightly (off under reduced
  motion).

**Everything below the KPI row** (lists, profiles, charts, breakdowns, getting started) uses
`<Folder>`'s default `variant="card"`: a regular rounded panel with a title row. Only danger
zones get a tinted (error) border.

## Motion

Animations follow the OS "reduce motion" setting unless the user overrides it in **Settings
→ Appearance → Motion** (System / Always animate / Reduce). The choice is stored per device
(`agentos-motion`) and applied before first paint as `<html data-motion>`, and both the CSS
and the `useMotion()` hook respect it. When the OS pauses motion, the workforce map says so
and offers **Turn on**. With nothing working, the live map still shows a slow, muted
"heartbeat" from the control plane to each department; it is never coloured like agent work.
Agent avatars carry a status ring: fast glow (working), amber pulse (needs approval), slow
breathing (idle), faint slow ping + drifting link (offline, awaiting heartbeat). **Preview
activity** (shown while nothing works) runs the simulator on the org's real departments and
agents behind a "Simulated preview · not real data" chip with **Stop**; real work ends it.

## States

Empty, error ("Unable to load …" + Try Again) and skeleton loading states are required
for every data view. Sample/preview data is always badged **Sample workforce · simulated**.

## Scrollbars

Thin, themed (`scrollbar-color`), green-tinted on the horizontal map scroller.
