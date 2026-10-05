import {
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  Code2,
  Headphones,
  Landmark,
  Megaphone,
  Scale,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Departments are created freely by each organization, so their colour and icon
 * are derived (stable per name) rather than configured per department.
 */
export const ACCENTS = [
  "var(--color-primary)",
  "var(--color-cyan)",
  "var(--color-lime)",
  "var(--color-purple)",
  "var(--color-orange)",
  "var(--color-pink)",
] as const;

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Index-based so neighbouring lanes differ; falls back to a name hash. */
export function departmentAccent(name: string, index?: number): string {
  const i = index ?? hashString(name.toLowerCase());
  return ACCENTS[i % ACCENTS.length]!;
}

const ICON_RULES: [RegExp, LucideIcon][] = [
  [/sales|revenue|growth/i, TrendingUp],
  [/market|brand|content|social/i, Megaphone],
  [/support|success|service|help/i, Headphones],
  [/financ|account|billing|payroll/i, Landmark],
  [/\bhr\b|human|people|talent|recruit/i, Users],
  [/operat|ops/i, Settings2],
  [/engineer|dev|platform|it\b|tech/i, Code2],
  [/analytic|data|insight|bi\b/i, BarChart3],
  [/inventory|warehouse|stock/i, Boxes],
  [/logistic|shipping|supply|fleet/i, Truck],
  [/legal|compliance|risk/i, Scale],
  [/security/i, ShieldCheck],
  [/procure|purchas|commerce|shop/i, ShoppingCart],
  [/strategy|exec|management/i, Briefcase],
];

export function departmentIcon(name: string): LucideIcon {
  return ICON_RULES.find(([re]) => re.test(name))?.[1] ?? Building2;
}

export const PROVIDER_STYLE: Record<string, { label: string; color: string }> = {
  Anthropic: { label: "A", color: "var(--color-orange)" },
  OpenAI: { label: "O", color: "var(--color-foreground)" },
  Google: { label: "G", color: "var(--color-cyan)" },
  Custom: { label: "C", color: "var(--color-purple)" },
};

export const STATUS_STYLE = {
  WORKING: { label: "Working", color: "var(--color-primary)" },
  WAITING: { label: "Needs approval", color: "var(--color-warning)" },
  IDLE: { label: "Idle", color: "var(--color-muted)" },
  FAILED: { label: "Failed", color: "var(--color-error)" },
} as const;

export function tint(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}
