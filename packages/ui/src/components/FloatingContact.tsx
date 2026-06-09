"use client";

import { formatPhoneDisplay, whatsAppUrl } from "@osaja/utils";
import { Headphones, Loader2, Mail, MessageCircle, Phone, Send, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

export type FloatingContactProps = {
  title?: string;
  note?: string;
  email?: string;
  phone?: string;
  whatsappNumbers?: string[];
  whatsappMessage?: string;
  /** light = member portal, dark = admin */
  variant?: "light" | "dark";
  /** Show the FAB even when no phone/email/WhatsApp is configured */
  alwaysShow?: boolean;
  /** In-app message to executives (member portal) */
  onSendMessage?: (message: string) => Promise<void>;
};

export function FloatingContact({
  title = "Contact us",
  note = "Reach the welfare team for help.",
  email,
  phone,
  whatsappNumbers = [],
  whatsappMessage,
  variant = "light",
  alwaysShow = false,
  onSendMessage,
}: FloatingContactProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const panelId = useId();
  const isDark = variant === "dark";

  const hasWhatsApp = whatsappNumbers.length > 0;
  const hasEmail = Boolean(email?.trim());
  const hasPhone = Boolean(phone?.trim());
  const hasDirectContact = hasWhatsApp || hasEmail || hasPhone;
  const visible = hasDirectContact || alwaysShow || Boolean(onSendMessage);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) {
      setSendError(null);
      setSent(false);
    }
  }, [open]);

  if (!visible) return null;

  async function handleSend() {
    if (!onSendMessage || draft.trim().length < 5) return;
    setSending(true);
    setSendError(null);
    try {
      await onSendMessage(draft.trim());
      setSent(true);
      setDraft("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  const content = (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-[90] bg-black/20 lg:bg-transparent"
          aria-label="Close contact panel"
          onClick={close}
        />
      ) : null}

      <div
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[100] flex flex-col items-end gap-3 lg:bottom-6"
        role="complementary"
        aria-label="Contact support"
      >
        {open ? (
          <div
            id={panelId}
            className={`w-[min(100vw-2rem,20rem)] rounded-2xl border p-4 shadow-xl ${
              isDark
                ? "border-white/10 bg-brand-navy-dark text-white"
                : "border-brand-navy/10 bg-white text-brand-navy"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{title}</p>
                <p className={`mt-1 text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>{note}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className={`shrink-0 rounded-lg p-1 ${
                  isDark ? "text-slate-400 hover:bg-white/10" : "text-slate-400 hover:bg-slate-100"
                }`}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {hasDirectContact ? (
              <ul className="mt-4 space-y-2">
                {whatsappNumbers.map((num) => (
                  <li key={num}>
                    <a
                      href={whatsAppUrl(num, whatsappMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#1ebe57]"
                    >
                      <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                      WhatsApp {formatPhoneDisplay(num)}
                    </a>
                  </li>
                ))}
                {hasPhone ? (
                  <li>
                    <a
                      href={`tel:${phone!.replace(/\s/g, "")}`}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
                        isDark ? "bg-white/10 hover:bg-white/15" : "bg-brand-navy/5 hover:bg-brand-navy/10"
                      }`}
                    >
                      <Phone className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden />
                      {formatPhoneDisplay(phone!)}
                    </a>
                  </li>
                ) : null}
                {hasEmail ? (
                  <li>
                    <a
                      href={`mailto:${email}`}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium break-all ${
                        isDark ? "bg-white/10 hover:bg-white/15" : "bg-brand-navy/5 hover:bg-brand-navy/10"
                      }`}
                    >
                      <Mail className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden />
                      {email}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}

            {onSendMessage ? (
              <div className={hasDirectContact ? "mt-4 border-t border-black/5 pt-4" : "mt-4"}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Ask the admin team
                </p>
                {sent ? (
                  <p className={`mt-2 text-sm ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                    Message sent. An executive will get back to you soon.
                  </p>
                ) : (
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Type your question or request…"
                      className={`mt-2 w-full resize-none rounded-xl border px-3 py-2 text-sm ${
                        isDark
                          ? "border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                          : "border-brand-navy/15 bg-white text-brand-navy placeholder:text-slate-400"
                      }`}
                    />
                    {sendError ? (
                      <p className="mt-1 text-xs text-red-500">{sendError}</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={sending || draft.trim().length < 5}
                      onClick={handleSend}
                      className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                        isDark
                          ? "bg-brand-gold text-brand-navy-dark hover:bg-brand-gold/90"
                          : "bg-brand-navy text-white hover:bg-brand-navy/90"
                      }`}
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send message
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-2 transition hover:scale-105 focus:outline-none focus-visible:ring-4 ${
            isDark
              ? "bg-brand-gold text-brand-navy-dark ring-brand-gold/30 focus-visible:ring-brand-gold/50"
              : "bg-brand-navy text-white ring-brand-navy/20 focus-visible:ring-brand-navy/40"
          }`}
          aria-label={open ? "Hide contact details" : "Show contact details"}
        >
          {open ? <X className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}
        </button>
      </div>
    </>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
