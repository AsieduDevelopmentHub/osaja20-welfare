"use client";

import { Loader2, Send } from "lucide-react";
import { useEffect, useRef } from "react";

export type InquiryChatMessage = {
  id: string;
  body: string;
  sender_role: "member" | "executive" | string;
  sender_name?: string | null;
  created_at: string;
};

export type InquiryChatPanelProps = {
  messages: InquiryChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  disabled?: boolean;
  variant?: "light" | "dark";
  placeholder?: string;
  emptyText?: string;
  minLength?: number;
  status?: "open" | "resolved" | string;
  /** Which side is “you” in the bubble layout */
  viewerRole?: "member" | "executive";
};

export function InquiryChatPanel({
  messages,
  draft,
  onDraftChange,
  onSend,
  sending = false,
  disabled = false,
  variant = "light",
  placeholder = "Type a message…",
  emptyText = "No messages yet. Say hello to the welfare team.",
  minLength = 1,
  status,
  viewerRole = "member",
}: InquiryChatPanelProps) {
  const isDark = variant === "dark";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.id]);

  return (
    <div className="flex min-h-0 flex-col">
      {status === "resolved" ? (
        <p
          className={`mb-2 rounded-lg px-2.5 py-1.5 text-xs ${
            isDark ? "bg-emerald-500/10 text-emerald-300" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          This conversation was marked resolved. Send a message to reopen it.
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className={`max-h-52 min-h-[8rem] overflow-y-auto rounded-xl border px-2 py-2 ${
          isDark ? "border-white/10 bg-black/20" : "border-brand-navy/10 bg-slate-50"
        }`}
      >
        {messages.length === 0 ? (
          <p className={`px-2 py-4 text-center text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            {emptyText}
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((msg) => {
              const isMine = msg.sender_role === viewerRole;
              return (
                <li
                  key={msg.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                      isMine
                        ? isDark
                          ? "bg-brand-gold text-brand-navy-dark"
                          : "bg-brand-navy text-white"
                        : isDark
                          ? "bg-white/10 text-slate-100"
                          : "bg-white text-brand-navy shadow-sm ring-1 ring-brand-navy/10"
                    }`}
                  >
                    {!isMine && msg.sender_name ? (
                      <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70`}>
                        {msg.sender_name}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p className={`mt-1 text-[10px] opacity-60`}>
                      {new Date(msg.created_at).toLocaleString("en-GH", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={2}
          maxLength={2000}
          disabled={disabled || sending}
          placeholder={placeholder}
          className={`w-full resize-none rounded-xl border px-3 py-2 text-sm disabled:opacity-50 ${
            isDark
              ? "border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              : "border-brand-navy/15 bg-white text-brand-navy placeholder:text-slate-400"
          }`}
        />
        <button
          type="button"
          disabled={disabled || sending || draft.trim().length < minLength}
          onClick={onSend}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-50 ${
            isDark
              ? "bg-brand-gold text-brand-navy-dark hover:bg-brand-gold/90"
              : "bg-brand-navy text-white hover:bg-brand-navy/90"
          }`}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send message
        </button>
      </div>
    </div>
  );
}
