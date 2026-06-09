"use client";

import { InquiryChatPanel, type InquiryChatMessage, ListRowsSkeleton } from "@osaja/ui";
import { CheckCircle2, MessageSquare, RefreshCw } from "lucide-react";
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
  message_count?: number;
  created_at: string;
  updated_at: string;
  messages?: InquiryChatMessage[];
}

const STATUS_FILTERS = ["", "open", "resolved"];

export default function InquiriesPage() {
  const [items, setItems] = useState<SupportInquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<SupportInquiry | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
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
      const page = res.data as PaginatedResponse<SupportInquiry> | undefined;
      setItems(page?.items ?? []);
      setTotal(page?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadThread = useCallback(async (inquiryId: string) => {
    setThreadLoading(true);
    setError("");
    try {
      const res = await apiFetch<SupportInquiry>(`/support/inquiries/${inquiryId}`);
      setThread(res.data as SupportInquiry);
      setSelectedId(inquiryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendReply = async () => {
    if (!thread || reply.trim().length < 1) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch<SupportInquiry>(`/support/inquiries/${thread.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: reply.trim() }),
      });
      setThread(res.data as SupportInquiry);
      setReply("");
      setSuccess("Reply sent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  };

  const resolveThread = async () => {
    if (!thread) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch<SupportInquiry>(`/support/inquiries/${thread.id}/resolve`, {
        method: "POST",
      });
      setThread(res.data as SupportInquiry);
      setSuccess("Conversation marked as resolved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminHeader
          title="Member inquiries"
          description={
            total > 0
              ? `${total} conversation${total === 1 ? "" : "s"} with members.`
              : "Ongoing chat threads from the member portal contact button."
          }
        />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          {loading ? (
            <ListRowsSkeleton rows={5} variant="dark" />
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-brand-navy/60 p-10 text-center text-slate-400">
              <MessageSquare className="mx-auto h-10 w-10" strokeWidth={1.25} />
              <p className="mt-2 text-sm">No inquiries {statusFilter ? `with status “${statusFilter}”` : "yet"}.</p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => loadThread(item.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedId === item.id
                    ? "border-brand-gold/40 bg-brand-navy/80"
                    : "border-white/10 bg-brand-navy/60 hover:bg-brand-navy/70"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{item.member_name}</p>
                    <p className="text-xs text-slate-500">{item.membership_id}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      item.status === "open"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-300">{item.message}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {item.message_count ?? 0} message{(item.message_count ?? 0) === 1 ? "" : "s"} ·{" "}
                  {new Date(item.updated_at || item.created_at).toLocaleString("en-GH")}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-brand-navy/60 p-4 sm:p-5">
          {!selectedId ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center text-center text-slate-400">
              <MessageSquare className="h-10 w-10" strokeWidth={1.25} />
              <p className="mt-2 text-sm">Select a conversation to view the full thread.</p>
            </div>
          ) : threadLoading ? (
            <ListRowsSkeleton rows={4} variant="dark" />
          ) : thread ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="font-semibold text-white">{thread.member_name}</p>
                  <p className="text-xs text-slate-500">{thread.membership_id}</p>
                  {thread.subject ? (
                    <p className="mt-1 text-sm font-medium text-brand-gold">{thread.subject}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/profile/${thread.member_id}`}
                    className="text-xs font-semibold text-brand-gold hover:underline"
                  >
                    View profile
                  </Link>
                  {thread.status === "open" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={resolveThread}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolve
                    </button>
                  ) : null}
                </div>
              </div>

              <InquiryChatPanel
                messages={thread.messages ?? []}
                draft={reply}
                onDraftChange={setReply}
                onSend={sendReply}
                sending={busy}
                variant="dark"
                viewerRole="executive"
                status={thread.status}
                minLength={1}
                placeholder="Type your reply…"
                emptyText="No messages in this thread yet."
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
