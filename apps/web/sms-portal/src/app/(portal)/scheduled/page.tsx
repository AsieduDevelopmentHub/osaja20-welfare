import { CalendarClock } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function ScheduledPage() {
  return (
    <PlaceholderPage
      title="Scheduled SMS"
      description="View and manage messages queued for future delivery."
      icon={CalendarClock}
    />
  );
}
