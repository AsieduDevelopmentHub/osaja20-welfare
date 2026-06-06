import type { Member } from "@osaja/types";

export function mapMember(raw: Record<string, unknown>): Member {
  return {
    id: String(raw.id),
    fullName: String(raw.full_name),
    email: String(raw.email),
    phoneNumber: String(raw.phone_number),
    dateOfBirth: String(raw.date_of_birth),
    membershipId: String(raw.membership_id),
    batch: Number(raw.batch),
    status: raw.status as Member["status"],
    emailVerified: Boolean(raw.email_verified),
    registrationDate: String(raw.registration_date ?? ""),
  };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}
