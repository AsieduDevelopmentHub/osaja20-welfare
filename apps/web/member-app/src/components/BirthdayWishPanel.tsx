"use client";

import { Loader2, MessageCircle, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface WishAuthor {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface WishItem {
  id: string;
  message: string;
  created_at: string;
  author: WishAuthor;
  replies: WishItem[];
}

interface BirthdayEntry {
  member_id: string;
  full_name: string;
  avatar_url?: string | null;
}

export function BirthdayWishPanel({ person }: { person: BirthdayEntry }) {
  const { member } = useAuth();
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const isRecipient = member?.id === person.member_id;
  const canWish = member && !isRecipient;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: WishItem[]; expires_note?: string; can_post?: boolean }>(
        `/birthdays/wishes?recipient_id=${encodeURIComponent(person.member_id)}`
      );
      setWishes(res.data?.items ?? []);
      setNote(res.data?.expires_note ?? "");
    } catch {
      setWishes([]);
    } finally {
      setLoading(false);
    }
  }, [person.member_id]);

  useEffect(() => {
    load();
  }, [load]);

  const sendWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/birthdays/wishes", {
        method: "POST",
        body: JSON.stringify({ recipient_id: person.member_id, message: message.trim() }),
      });
      setMessage("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send wish");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (wishId: string) => {
    if (!replyText.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/birthdays/wishes/${wishId}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: replyText.trim() }),
      });
      setReplyTo(null);
      setReplyText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post reply");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-200/80 bg-white/80 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-900">
        <MessageCircle className="h-4 w-4" />
        Birthday wishes
        {note ? <span className="font-normal text-amber-700/80">· {note}</span> : null}
      </p>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </div>
      ) : wishes.length === 0 ? (
        <p className="text-sm text-slate-500">No wishes yet — be the first to celebrate!</p>
      ) : (
        <ul className="space-y-3">
          {wishes.map((w) => (
            <li key={w.id} className="rounded-lg bg-amber-50/60 p-3">
              <div className="flex gap-3">
                <ProfileAvatar
                  member={{ fullName: w.author.full_name, avatarUrl: w.author.avatar_url ?? undefined }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700">{w.author.full_name}</p>
                  <p className="mt-0.5 text-sm text-slate-800">{w.message}</p>
                  {w.replies.map((r) => (
                    <div key={r.id} className="mt-2 flex gap-2 border-l-2 border-amber-300 pl-3">
                      <ProfileAvatar
                        member={{ fullName: r.author.full_name, avatarUrl: r.author.avatar_url ?? undefined }}
                        size="sm"
                      />
                      <div>
                        <p className="text-xs font-semibold text-amber-800">{r.author.full_name}</p>
                        <p className="text-sm text-slate-700">{r.message}</p>
                      </div>
                    </div>
                  ))}
                  {isRecipient && w.replies.length === 0 ? (
                    replyTo === w.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Say thank you…"
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => sendReply(w.id)}
                          className="rounded-lg bg-brand-navy px-3 py-2 text-white disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReplyTo(w.id)}
                        className="mt-2 text-xs font-semibold text-brand-navy hover:underline"
                      >
                        Reply
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWish ? (
        <form onSubmit={sendWish} className="mt-4 flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Wish ${person.full_name} a happy birthday…`}
            maxLength={500}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !message.trim()}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </form>
      ) : null}
    </div>
  );
}
