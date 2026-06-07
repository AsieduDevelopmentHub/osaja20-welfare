import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  HeartHandshake,
  Megaphone,
  Settings,
  User,
  Users,
  Vote,
  Wallet,
} from "lucide-react";
import type { NavItem } from "./nav-config.js";

export const adminNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/members", label: "Members", icon: Users },
  { href: "/welfare", label: "Welfare", icon: HeartHandshake },
  { href: "/contributions", label: "Contributions", icon: Wallet },
  { href: "/voting", label: "Voting", icon: Vote },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: ClipboardList },
  { href: "/profile", label: "My profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export interface AdminModule {
  name: string;
  desc: string;
  href: string;
  icon: LucideIcon;
}

export const adminModules: AdminModule[] = [
  { name: "Members", desc: "Search, filter, archive", href: "/members", icon: Users },
  { name: "Welfare", desc: "Case workflow management", href: "/welfare", icon: HeartHandshake },
  { name: "Contributions", desc: "Ledger & receipts", href: "/contributions", icon: Wallet },
  { name: "Voting", desc: "Elections & decisions", href: "/voting", icon: Vote },
  { name: "Announcements", desc: "Publish & notify", href: "/announcements", icon: Megaphone },
  { name: "Reports", desc: "Export CSV & summaries", href: "/reports", icon: BarChart3 },
  { name: "Settings", desc: "Payment gateways & dues", href: "/settings", icon: Settings },
];
