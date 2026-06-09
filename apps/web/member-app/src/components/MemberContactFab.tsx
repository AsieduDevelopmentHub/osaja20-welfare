"use client";

import { FloatingContact } from "@osaja/ui";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { env, getApiBase } from "@/lib/env";

type ContactPayload = {
  title?: string;
  note?: string;
  email?: string;
  phone?: string;
  whatsapp_numbers?: string[];
  whatsapp_message?: string;
};

export function MemberContactFab() {
  const [apiContact, setApiContact] = useState<ContactPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/settings/contact`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { success?: boolean; data?: ContactPayload };
        if (!cancelled && json.success && json.data) {
          setApiContact(json.data);
        }
      } catch {
        // Env fallback below
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const contact = useMemo(
    () => ({
      title: apiContact?.title || env.contact.title,
      note: apiContact?.note || env.contact.note,
      email: apiContact?.email || env.contact.email,
      phone: apiContact?.phone || env.contact.phone,
      whatsappNumbers:
        apiContact?.whatsapp_numbers?.length ? apiContact.whatsapp_numbers : env.contact.whatsappNumbers,
      whatsappMessage: apiContact?.whatsapp_message || env.contact.whatsappMessage,
    }),
    [apiContact]
  );

  async function handleSendMessage(message: string) {
    await apiFetch("/support/inquiries", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  return (
    <FloatingContact
      variant="light"
      alwaysShow
      title={contact.title}
      note={contact.note}
      email={contact.email}
      phone={contact.phone}
      whatsappNumbers={contact.whatsappNumbers}
      whatsappMessage={contact.whatsappMessage}
      onSendMessage={handleSendMessage}
    />
  );
}
