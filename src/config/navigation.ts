import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  CircleDollarSign,
  LayoutDashboard,
  ListChecks,
  Plug,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** false = shown as "Soon" and not linked (no dead routes). */
  available: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, available: true },
  { label: "Departments", href: "/departments", icon: Building2, available: false },
  { label: "Agents", href: "/agents", icon: Bot, available: false },
  { label: "Tasks", href: "/tasks", icon: ListChecks, available: false },
  { label: "Workflows", href: "/workflows", icon: Workflow, available: false },
  { label: "Activity", href: "/activity", icon: Activity, available: false },
  { label: "Approvals", href: "/approvals", icon: ShieldCheck, available: false },
  { label: "Costs & Usage", href: "/costs", icon: CircleDollarSign, available: false },
  { label: "Analytics", href: "/analytics", icon: BarChart3, available: false },
  { label: "Integrations", href: "/integrations", icon: Plug, available: false },
  { label: "Team", href: "/team", icon: Users, available: false },
  { label: "Settings", href: "/settings", icon: Settings, available: true },
];
