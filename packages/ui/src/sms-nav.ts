import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarClock,
  History,
  LayoutDashboard,
  MessageSquarePlus,
  MessagesSquare,
  Settings,
  Users,
  Workflow,
  FileText,
} from "lucide-react";
import type { NavItem } from "./nav-config.js";

export const smsNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Compose SMS", icon: MessageSquarePlus },
  { href: "/history", label: "History", icon: History },
  { href: "/campaigns", label: "Campaigns", icon: MessagesSquare },
  { href: "/scheduled", label: "Scheduled SMS", icon: CalendarClock },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/recipients", label: "Recipient Groups", icon: Users },
  { href: "/automation", label: "Automation", icon: Workflow },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export interface SmsModule {
  name: string;
  desc: string;
  href: string;
  icon: LucideIcon;
}

export const smsModules: SmsModule[] = [
  { name: "Compose SMS", desc: "Write & send messages", href: "/compose", icon: MessageSquarePlus },
  { name: "Campaigns", desc: "Bulk SMS campaigns", href: "/campaigns", icon: MessagesSquare },
  { name: "Scheduled", desc: "Upcoming deliveries", href: "/scheduled", icon: CalendarClock },
  { name: "Templates", desc: "Reusable message drafts", href: "/templates", icon: FileText },
  { name: "Recipients", desc: "Member groups & filters", href: "/recipients", icon: Users },
  { name: "Automation", desc: "Birthdays, reminders & more", href: "/automation", icon: Workflow },
  { name: "History", desc: "Delivery log & search", href: "/history", icon: History },
  { name: "Reports", desc: "Usage & performance", href: "/reports", icon: BarChart3 },
  { name: "Settings", desc: "Arkesel & sender ID", href: "/settings", icon: Settings },
];
