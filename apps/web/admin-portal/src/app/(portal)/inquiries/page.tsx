"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse } from "@/lib/types";

interface SupportInquiry {
  id: string;
  member_id: string;
  member_name: string;
  membership_id: string;
  subject: string | null;
  message: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const STATUS_FILTERS = ["", "open", "resolved"];

export default function InquiriesPage() {
  const [items, setItems] = useState<SupportInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");
  const [selected, setSelected] = useState<SupportInquiry | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = statusFilter ? `&status=${statusFilter}` : "";
      const res = await apiFetch<PaginatedResponse<SupportInquiry>>(
        `/support/inquiries?page=1&page_size=50${q}`
      );
      setItems(res.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const sendReply = async () => {
    if (!selected || reply.trim().length < 1) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/support/inquiries/${selected.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: reply.trim() }),
      });
      setSuccess("Reply sent. The member was notified in-app.");
      setReply("");
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Member inquiries"
        description="Messages from the contact button on the member portal. Reply here to notify the member."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              statusFilter === s
                ? "bg-brand-gold text-brand-navy-dark"
                : "bg-white/10 text-slate-300 hover:bg-white/15"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300" role="status">
          {success}
        </div>
      ) : null}

      {loading ? (
        <ListRowsSkeleton rows={5} variant="dark" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-brand-navy/60 p-10 text-center text-slate-400">
          <MessageSquare className="mx-auto h-10 w-10" strokeWidth={1.25} />
          <p className="mt-2 text-sm">No inquiries {statusFilter ? `with status “${statusFilter}”` : "yet"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 sm:p-5 ${
                selected?.id === item.id
                  ? "border-brand-gold/40 bg-brand-navy/80"
                  : "border-white/10 bg-brand-navy/60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{item.member_name}</p>
                    <span className="text-xs text-slate-500">{item.membership_id}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        item.status === "open"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(item.created_at).toLocaleString("en-GH")}
                  </p>
                  {item.subject ? (
                    <p className="mt-2 text-sm font-medium text-brand-gold">{item.subject}</p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{item.message}</p>
                  {item.admin_reply ? (
                    <div className="mt-3 rounded-xl bg-white/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your reply</p>
                      <p className="mt-1 text-sm text-slate-200">{item.admin_reply}</p>
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Link
                    href={`/profile/${item.member_id}`}
                    className="text-xs font-semibold text-brand-gold hover:underline"
                  >
                    View profile
                  </Link>
                  {item.status === "open" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(selected?.id === item.id ? null : item);
                        setReply("");
                        setSuccess("");
                      }}
                      className="rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-brand-navy-dark hover:bg-brand-gold/90"
                    >
                      {selected?.id === item.id ? "Cancel" : "Reply"}
                    </button>
                  ) : null}
                </div>
              </div>

              {selected?.id === item.id ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Reply to member
                  </label>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Type your response…"
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={busy || reply.trim().length < 1}
                    onClick={sendReply}
                    className="mt-3 flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Send reply
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
