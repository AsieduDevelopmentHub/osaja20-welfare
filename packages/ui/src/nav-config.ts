import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Cake,
  LayoutDashboard,
  Settings,
  User,
  Vote,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const memberNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contributions", label: "Contributions", icon: Wallet },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/birthdays", label: "Birthdays", icon: Cake },
  { href: "/voting", label: "Voting", icon: Vote },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];
