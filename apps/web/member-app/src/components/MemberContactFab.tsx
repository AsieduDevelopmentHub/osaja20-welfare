"use client";

import { FloatingContact, type InquiryChatMessage } from "@osaja/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ActiveInquiry = {
  id: string;
  status: string;
  messages?: InquiryChatMessage[];
};

export function MemberContactFab() {
  const [apiContact, setApiContact] = useState<ContactPayload | null>(null);
  const [inquiry, setInquiry] = useState<ActiveInquiry | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);

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

  const loadThread = useCallback(async () => {
    setLoadingChat(true);
    try {
      const res = await apiFetch<ActiveInquiry | null>("/support/inquiries/active");
      setInquiry((res.data as ActiveInquiry | null) ?? null);
    } catch {
      setInquiry(null);
    } finally {
      setLoadingChat(false);
    }
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
    setSending(true);
    try {
      if (inquiry?.id) {
        const res = await apiFetch<ActiveInquiry>(`/support/inquiries/${inquiry.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ message }),
        });
        setInquiry(res.data as ActiveInquiry);
      } else {
        const res = await apiFetch<ActiveInquiry>("/support/inquiries", {
          method: "POST",
          body: JSON.stringify({ message }),
        });
        setInquiry(res.data as ActiveInquiry);
      }
      setDraft("");
    } finally {
      setSending(false);
    }
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
      chatMessages={inquiry?.messages ?? []}
      chatStatus={inquiry?.status}
      chatDraft={draft}
      onChatDraftChange={setDraft}
      onChatSend={() => handleSendMessage(draft.trim())}
      chatSending={sending}
      chatLoading={loadingChat}
      onChatOpen={loadThread}
      chatMinLength={5}
    />
  );
}
