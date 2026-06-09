import type { LucideIcon } from "lucide-react";
import {
  Cake,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
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
  { href: "/welfare", label: "Welfare", icon: HeartHandshake },
  { href: "/voting", label: "Voting", icon: Vote },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/birthdays", label: "Birthdays", icon: Cake },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];
