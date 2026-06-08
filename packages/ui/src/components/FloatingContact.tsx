"use client";

import { formatPhoneDisplay, whatsAppUrl } from "@osaja/utils";
import { Headphones, Mail, MessageCircle, Phone, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";

export type FloatingContactProps = {
  title?: string;
  note?: string;
  email?: string;
  phone?: string;
  whatsappNumbers?: string[];
  whatsappMessage?: string;
  /** light = member portal, dark = admin */
  variant?: "light" | "dark";
};

export function FloatingContact({
  title = "Contact us",
  note = "Reach the welfare team for help.",
  email,
  phone,
  whatsappNumbers = [],
  whatsappMessage,
  variant = "light",
}: FloatingContactProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isDark = variant === "dark";

  const hasWhatsApp = whatsappNumbers.length > 0;
  const hasEmail = Boolean(email?.trim());
  const hasPhone = Boolean(phone?.trim());
  const visible = hasWhatsApp || hasEmail || hasPhone;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!visible) return null;

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 lg:bg-transparent"
          aria-label="Close contact panel"
          onClick={close}
        />
      ) : null}

      <div
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end gap-3 lg:bottom-6"
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
}
