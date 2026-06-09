"use client";

import { formatPhoneDisplay, whatsAppUrl } from "@osaja/utils";
import { Headphones, Loader2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { InquiryChatPanel, type InquiryChatMessage } from "./InquiryChatPanel.js";

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
  /** @deprecated Use chat props for threaded conversations */
  onSendMessage?: (message: string) => Promise<void>;
  /** Threaded inquiry chat */
  chatMessages?: InquiryChatMessage[];
  chatStatus?: string;
  chatDraft?: string;
  onChatDraftChange?: (value: string) => void;
  onChatSend?: () => void | Promise<void>;
  chatSending?: boolean;
  chatLoading?: boolean;
  onChatOpen?: () => void | Promise<void>;
  chatMinLength?: number;
  /** Allow drag-to-reposition the support button (position is saved in localStorage) */
  draggable?: boolean;
};

const FAB_POSITION_KEY = "osaja-contact-fab-position";
const FAB_SIZE = 56;
const PANEL_GAP_PX = 12;
const PANEL_WIDTH = "min(100vw - 2rem, 22rem)";

type FabPosition = { bottom: number; right: number };

type PanelPlacement = {
  /** Panel sits below the FAB (FAB is in the top half of the screen) */
  panelBelow: boolean;
  /** Panel anchors on the left and grows toward the right (FAB is in the left half) */
  alignStart: boolean;
};

function defaultFabPosition(): FabPosition {
  if (typeof window === "undefined") return { bottom: 76, right: 16 };
  const mobileNav = window.innerWidth < 1024 ? 76 : 24;
  return { bottom: mobileNav, right: 16 };
}

function loadFabPosition(): FabPosition {
  if (typeof window === "undefined") return defaultFabPosition();
  try {
    const raw = localStorage.getItem(FAB_POSITION_KEY);
    if (!raw) return defaultFabPosition();
    const parsed = JSON.parse(raw) as FabPosition;
    if (typeof parsed.bottom === "number" && typeof parsed.right === "number") {
      return parsed;
    }
  } catch {
    // ignore
  }
  return defaultFabPosition();
}

function clampFabPosition(pos: FabPosition): FabPosition {
  if (typeof window === "undefined") return pos;
  const maxBottom = Math.max(8, window.innerHeight - FAB_SIZE - 8);
  const maxRight = Math.max(8, window.innerWidth - FAB_SIZE - 8);
  return {
    bottom: Math.min(Math.max(8, pos.bottom), maxBottom),
    right: Math.min(Math.max(8, pos.right), maxRight),
  };
}

function getPanelPlacement(pos: FabPosition, viewport: { w: number; h: number }): PanelPlacement {
  const fabLeft = viewport.w - pos.right - FAB_SIZE;
  const fabTop = viewport.h - pos.bottom - FAB_SIZE;
  return {
    panelBelow: fabTop < viewport.h / 2,
    alignStart: fabLeft < viewport.w / 2,
  };
}

function panelPositionStyle(placement: PanelPlacement): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    width: PANEL_WIDTH,
    maxWidth: PANEL_WIDTH,
  };
  if (placement.panelBelow) {
    base.top = `calc(100% + ${PANEL_GAP_PX}px)`;
  } else {
    base.bottom = `calc(100% + ${PANEL_GAP_PX}px)`;
  }
  if (placement.alignStart) {
    base.left = 0;
  } else {
    base.right = 0;
  }
  return base;
}

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
  chatMessages,
  chatStatus,
  chatDraft = "",
  onChatDraftChange,
  onChatSend,
  chatSending = false,
  chatLoading = false,
  onChatOpen,
  chatMinLength = 5,
  draggable = true,
}: FloatingContactProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fabPos, setFabPos] = useState<FabPosition>(defaultFabPosition);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startBottom: 0,
    startRight: 0,
  });
  const fabPosRef = useRef(fabPos);
  fabPosRef.current = fabPos;
  const [legacyDraft, setLegacyDraft] = useState("");
  const [legacySending, setLegacySending] = useState(false);
  const [legacySent, setLegacySent] = useState(false);
  const [legacySendError, setLegacySendError] = useState<string | null>(null);
  const panelId = useId();
  const isDark = variant === "dark";

  const hasChat = Boolean(onChatSend && onChatDraftChange);
  const hasWhatsApp = whatsappNumbers.length > 0;
  const hasEmail = Boolean(email?.trim());
  const hasPhone = Boolean(phone?.trim());
  const hasDirectContact = hasWhatsApp || hasEmail || hasPhone;
  const visible = hasDirectContact || alwaysShow || hasChat || Boolean(onSendMessage);

  const placement = useMemo(
    () =>
      viewport.w > 0
        ? getPanelPlacement(fabPos, viewport)
        : { panelBelow: false, alignStart: false },
    [fabPos, viewport]
  );

  const close = useCallback(() => setOpen(false), []);

  const saveFabPosition = useCallback((pos: FabPosition) => {
    try {
      localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(pos));
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const syncViewport = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
  }, []);

  useEffect(() => {
    setMounted(true);
    setFabPos(loadFabPosition());
    syncViewport();
  }, [syncViewport]);

  useEffect(() => {
    if (!draggable) return;
    const onResize = () => {
      syncViewport();
      setFabPos((pos) => clampFabPosition(pos));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draggable, syncViewport]);

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
      setLegacySendError(null);
      setLegacySent(false);
      return;
    }
    if (hasChat) {
      void onChatOpen?.();
    }
  }, [open, hasChat, onChatOpen]);

  const onFabPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggable || e.button !== 0) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startBottom: fabPos.bottom,
      startRight: fabPos.right,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onFabPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    const next = clampFabPosition({
      bottom: dragRef.current.startBottom - dy,
      right: dragRef.current.startRight - dx,
    });
    setFabPos(next);
  };

  const onFabPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (wasDrag) {
      saveFabPosition(fabPosRef.current);
      return;
    }
    if (draggable) {
      setOpen((v) => !v);
    }
  };

  async function handleLegacySend() {
    if (!onSendMessage || legacyDraft.trim().length < 5) return;
    setLegacySending(true);
    setLegacySendError(null);
    try {
      await onSendMessage(legacyDraft.trim());
      setLegacySent(true);
      setLegacyDraft("");
    } catch (err) {
      setLegacySendError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setLegacySending(false);
    }
  }

  if (!visible) return null;

  const panelStyle = panelPositionStyle(placement);

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
        className="fixed z-[100]"
        style={{ bottom: fabPos.bottom, right: fabPos.right }}
        role="complementary"
        aria-label="Contact support"
      >
        <div className="relative">
          {open ? (
            <div
              id={panelId}
              style={panelStyle}
              className={`rounded-2xl border p-4 shadow-xl ${
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
                        {email}
                      </a>
                    </li>
                  ) : null}
                </ul>
              ) : null}

              {hasChat ? (
                <div className={hasDirectContact ? "mt-4 border-t border-black/5 pt-4" : "mt-4"}>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Chat with the admin team
                  </p>
                  {chatLoading ? (
                    <div className="mt-3 flex justify-center py-6">
                      <Loader2 className={`h-6 w-6 animate-spin ${isDark ? "text-slate-400" : "text-slate-400"}`} />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <InquiryChatPanel
                        messages={chatMessages ?? []}
                        draft={chatDraft}
                        onDraftChange={onChatDraftChange!}
                        onSend={() => void onChatSend?.()}
                        sending={chatSending}
                        variant={variant}
                        status={chatStatus}
                        minLength={chatMinLength}
                        placeholder="Type your question or follow-up…"
                      />
                    </div>
                  )}
                </div>
              ) : onSendMessage ? (
                <div className={hasDirectContact ? "mt-4 border-t border-black/5 pt-4" : "mt-4"}>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Ask the admin team
                  </p>
                  {legacySent ? (
                    <p className={`mt-2 text-sm ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                      Message sent. An executive will get back to you soon.
                    </p>
                  ) : (
                    <>
                      <textarea
                        value={legacyDraft}
                        onChange={(e) => setLegacyDraft(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder="Type your question or request…"
                        className={`mt-2 w-full resize-none rounded-xl border px-3 py-2 text-sm ${
                          isDark
                            ? "border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                            : "border-brand-navy/15 bg-white text-brand-navy placeholder:text-slate-400"
                        }`}
                      />
                      {legacySendError ? <p className="mt-1 text-xs text-red-500">{legacySendError}</p> : null}
                      <button
                        type="button"
                        disabled={legacySending || legacyDraft.trim().length < 5}
                        onClick={handleLegacySend}
                        className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                          isDark
                            ? "bg-brand-gold text-brand-navy-dark hover:bg-brand-gold/90"
                            : "bg-brand-navy text-white hover:bg-brand-navy/90"
                        }`}
                      >
                        {legacySending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
            onPointerDown={onFabPointerDown}
            onPointerMove={onFabPointerMove}
            onPointerUp={onFabPointerUp}
            onPointerCancel={onFabPointerUp}
            onClick={draggable ? (e) => e.preventDefault() : () => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            style={{ touchAction: draggable ? "none" : undefined }}
            className={`flex h-14 w-14 cursor-grab items-center justify-center rounded-full shadow-lg ring-2 transition hover:scale-105 focus:outline-none focus-visible:ring-4 active:cursor-grabbing ${
              isDark
                ? "bg-brand-gold text-brand-navy-dark ring-brand-gold/30 focus-visible:ring-brand-gold/50"
                : "bg-brand-navy text-white ring-brand-navy/20 focus-visible:ring-brand-navy/40"
            }`}
            aria-label={
              draggable
                ? open
                  ? "Hide contact details (drag to move)"
                  : "Show contact details (drag to move)"
                : open
                  ? "Hide contact details"
                  : "Show contact details"
            }
          >
            {open ? <X className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}
          </button>
        </div>
      </div>
    </>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
