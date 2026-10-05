# Design System

Direction: **premium enterprise AI infrastructure** — modern SaaS, financial
analytics, developer observability. Dark-first. Not a gaming dashboard; gradients
are used sparingly (logo mark only).

## Tokens

Defined once in `src/app/globals.css` (`@theme`) and consumed via Tailwind
utilities (`bg-surface`, `text-muted`, `border-border`, …). Never hard-code hex
values in components.

| Token                 | Value     | Use                                 |
| --------------------- | --------- | ----------------------------------- |
| `background`          | `#070D1A` | App background                      |
| `surface`             | `#0D1726` | Cards, sidebar                      |
| `raised`              | `#111C2D` | Inputs, hover, popovers             |
| `border`              | `#24324A` | All borders/dividers                |
| `primary`             | `#4F7CFF` | Primary actions, focus rings, links |
| `purple`              | `#8B5CF6` | Secondary accent (AI/model)         |
| `cyan`                | `#35D8C2` | Tertiary accent (tokens/usage)      |
| `success`             | `#35D08F` | Success, ONLINE/COMPLETED           |
| `warning`             | `#F5BD4F` | Warnings, WAITING                   |
| `error`               | `#F05D70` | Errors, FAILED                      |
| `text` (`foreground`) | `#EEF4FF` | Primary text                        |
| `muted`               | `#8D9BB3` | Secondary text                      |

## Shape & spacing

- Font: **Inter** (`next/font`), tabular numerals for metrics (`tabular-nums`).
- Radius: cards **12px** (`rounded-card`), buttons/inputs **8px** (`rounded-control`).
- Spacing: 4px base (Tailwind default scale).
- Icons: **Lucide** only, 16px inline / 20px nav.

## Components (`src/components/ui`)

| Component                                           | Notes                                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `Button`                                            | variants `primary`, `secondary`, `ghost`, `danger`; sizes `sm`, `md`, `lg` |
| `Card` (+ `CardHeader`, `CardTitle`, `CardContent`) | 12px radius surface                                                        |
| `Input`, `Select`, `Label`, `FormField`             | field errors rendered under input with `aria-describedby`                  |
| `Badge`                                             | neutral / primary / success / warning / error                              |
| `StatusIndicator`                                   | **icon + text label + color** — status is never conveyed by color alone    |
| `EmptyState`                                        | icon, title, description, optional action                                  |
| `ErrorState`                                        | friendly message + _Try Again_; never raw errors                           |
| `Skeleton`                                          | loading placeholders; every async route has a `loading.tsx`                |

## States

- **Empty** — copy from the spec, e.g. "Your AI workforce is empty." + _Connect Your First Agent_.
- **Error** — "Unable to load …" + _Try Again_; details go to server logs only.
- **Loading** — skeletons, never a frozen UI.

## Accessibility

- Visible focus ring (`primary`) on every interactive element.
- Status uses text + icon + color. Contrast of `muted` on `surface` ≥ 4.5:1.
- Forms: labels bound to inputs, errors announced via `role="alert"`.
