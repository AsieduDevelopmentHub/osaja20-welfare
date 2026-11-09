"use client";

import { Alert } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@osaja/utils";
import { Camera, Check, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, QrCode, RefreshCw, Search, Ticket, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Category = {
  id: string;
  name: string;
  description: string;
  price: string;
  admissions_per_ticket: number;
  inventory_limit: number | null;
  inventory_remaining: number | null;
  sold_quantity: number;
  reserved_quantity: number;
  is_active: boolean;
};

type Order = {
  reference: string;
  purchaser_name: string;
  purchaser_email: string | null;
  category: string;
  quantity: number;
  amount: string;
  status: string;
  payment_method: string;
  manual_payment_reference?: string;
  manual_payment_phone?: string;
  manual_payment_sender_name?: string;
  ticket_numbers: string[];
  payment_submitted_at?: string;
  created_at: string;
};

type Stat = { orders: number; revenue: string; tickets: number };
type Overview = {
  event: { title: string; venue: string; starts_at: string };
  categories: Category[];
  orders: Order[];
  pagination: { page: number; page_size: number; total: number };
  stats: Record<string, Stat> & { checked_in: number };
};
type TicketPreview = {
  ticket_id: string;
  ticket_number: string | null;
  purchaser_name: string;
  purchaser_email: string | null;
  purchaser_phone: string;
  order_reference: string;
  category: string;
  status: string;
  admission_entitlement: number;
  admissions_used: number;
  currently_inside: number;
  outside: number;
  admissions_remaining: number;
  can_enter: boolean;
  can_exit: boolean;
  can_return: boolean;
  history?: { count: number; direction?: string; gate: string; at: string; staff_id: string }[];
  outcome?: string;
  message?: string;
};
type DetectedBarcode = { rawValue: string };
type NativeBarcodeDetector = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorWindow = Window & {
  BarcodeDetector?: new (options: { formats: string[] }) => NativeBarcodeDetector;
};

const LOCAL_DEVICE_KEY = "osaja_ticket_scanner_device";

export default function TicketManagementPage() {
  const { member } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [savingCategory, setSavingCategory] = useState("");
  const [reviewingOrder, setReviewingOrder] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [gate, setGate] = useState("Gate 1");
  const [admissionCount, setAdmissionCount] = useState(1);
  const [ticketCode, setTicketCode] = useState("");
  const [preview, setPreview] = useState<TicketPreview | null>(null);
  const [previewMatches, setPreviewMatches] = useState<TicketPreview[]>([]);
  const [actionResult, setActionResult] = useState<TicketPreview | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const scannerRef = useRef<{ stop: () => void } | null>(null);
  const refreshSequence = useRef(0);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    scannerRef.current?.stop();
    scannerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!member) return;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    setPageError("");
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "10", search });
      const response = await apiFetch<Overview>(`/tickets/admin/overview?${params}`);
      if (sequence === refreshSequence.current) setOverview(response.data ?? null);
    } catch (error) {
      if (sequence === refreshSequence.current) setPageError(error instanceof Error ? error.message : "Could not load ticket sales.");
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [member, page, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => () => {
    scannerRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  async function saveCategory(
    event: React.FormEvent<HTMLFormElement>,
    category: Category,
    price: string,
    inventory: string,
    isActive: boolean,
  ) {
    event.preventDefault();
    setSavingCategory(category.id);
    setPageError("");
    try {
      await apiFetch(`/tickets/admin/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          price: Number(price),
          inventory_limit: inventory.trim() ? Number(inventory) : null,
          is_active: isActive,
        }),
      });
      await refresh();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Ticket category could not be updated.");
    } finally {
      setSavingCategory("");
    }
  }

  async function resendDelivery(order: Order) {
    setReviewingOrder(order.reference);
    setPageError("");
    try {
      const response = await apiFetch<{ delivery: { email: string; sms: string } }>(
        `/tickets/admin/orders/${encodeURIComponent(order.reference)}/resend-delivery`,
        { method: "POST", body: JSON.stringify({}) },
      );
      const delivery = response.data?.delivery;
      window.alert(`Delivery: email=${delivery?.email ?? "n/a"}, sms=${delivery?.sms ?? "n/a"}`);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not resend ticket delivery.");
    } finally {
      setReviewingOrder("");
    }
  }

  async function reviewOrder(order: Order, decision: "confirm" | "reject") {
    let note: string | undefined;
    if (decision === "confirm") {
      if (!window.confirm(`Confirm that the ${order.payment_method.toUpperCase()} payment for ${order.reference} was received? This issues tickets.`)) return;
    } else {
      const reason = window.prompt("Reason for rejecting this payment:", "Payment reference could not be verified");
      if (reason === null) return;
      note = reason.trim() || "Payment reference could not be verified";
    }
    setReviewingOrder(order.reference);
    setPageError("");
    try {
      await apiFetch(`/tickets/admin/orders/${encodeURIComponent(order.reference)}/${decision}`, {
        method: "POST",
        body: JSON.stringify(decision === "reject" ? { note } : {}),
      });
      await refresh();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Payment review failed.");
    } finally {
      setReviewingOrder("");
    }
  }

  const lookupTicket = useCallback(async (query = ticketCode) => {
    setScanError("");
    setActionResult(null);
    setPreview(null);
    setPreviewMatches([]);
    if (!query.trim()) {
      setScanError("Scan a QR code or enter a ticket number / guest name.");
      return;
    }
    try {
      const response = await apiFetch<{ matches: TicketPreview[]; exact: boolean }>("/tickets/lookup", {
        method: "POST",
        body: JSON.stringify({ query: query.trim() }),
      });
      const matches = response.data?.matches ?? [];
      if (!matches.length) {
        setScanError("No matching tickets found.");
        return;
      }
      if (matches.length === 1) {
        setPreview(matches[0]);
        setTicketCode(matches[0].ticket_number ?? query.trim());
      } else {
        setPreviewMatches(matches);
      }
    } catch (error) {
      setScanError(
        error instanceof Error
          ? error.message
          : "Lookup failed. No gate action was recorded.",
      );
    }
  }, [ticketCode]);

  const applyGateAction = useCallback(async (action: "enter" | "exit" | "return") => {
    if (!preview?.ticket_number && !ticketCode.trim()) {
      setScanError("Verify a ticket before taking a gate action.");
      return;
    }
    setActing(true);
    setScanError("");
    setActionResult(null);
    try {
      let deviceId = localStorage.getItem(LOCAL_DEVICE_KEY);
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(LOCAL_DEVICE_KEY, deviceId);
      }
      const token = preview?.ticket_number || ticketCode.trim();
      const response = await apiFetch<TicketPreview>("/tickets/scan", {
        method: "POST",
        body: JSON.stringify({
          token,
          action,
          admission_count: admissionCount,
          gate,
          device_id: deviceId,
        }),
      });
      const result = response.data ?? null;
      setActionResult(result);
      if (result) setPreview(result);
      void refresh();
    } catch (error) {
      setScanError(
        error instanceof Error
          ? error.message
          : "Network or verification error. No gate action was recorded.",
      );
    } finally {
      setActing(false);
    }
  }, [admissionCount, gate, preview, refresh, ticketCode]);

  async function startCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not available here. Enter the ticket code manually.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();
      setScanning(true);

      let detector: NativeBarcodeDetector | null = null;
      const Detector = (window as BarcodeDetectorWindow).BarcodeDetector;

      if (Detector) {
        detector = new Detector({ formats: ["qr_code"] });
        const scanFrame = async () => {
          if (!streamRef.current || !detector) return;
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) {
                const token = codes[0].rawValue;
                stopCamera();
                await lookupTicket(token);
                return;
              }
            } catch {
              setCameraError("Could not read the camera image. Use manual ticket lookup instead.");
              stopCamera();
              return;
            }
          }
          frameRef.current = requestAnimationFrame(() => void scanFrame());
        };
        frameRef.current = requestAnimationFrame(() => void scanFrame());
      } else {
        try {
          const { BrowserQRCodeReader } = await import("@zxing/browser");
          const reader = new BrowserQRCodeReader();
          const controls = await reader.decodeFromVideoElement(video, (result, error, scanner) => {
            if (result) {
              const token = result.getText();
              scanner.stop();
              stopCamera();
              void lookupTicket(token);
            } else if (error && !["NotFoundException", "ChecksumException", "FormatException"].includes(typeof error.getKind === "function" ? error.getKind() : error.name)) {
              setCameraError("QR scan failed. Ensure the code is visible and well-lit.");
              scanner.stop();
              stopCamera();
            }
          });
          if (streamRef.current) scannerRef.current = controls;
          else controls.stop();
        } catch {
          setCameraError("QR scanner library is not available. Enter the ticket code manually.");
          stopCamera();
        }
      }
    } catch {
      setCameraError("Camera permission was denied or the camera is unavailable. Enter the ticket code manually.");
      stopCamera();
    }
  }

  const paidStats = overview?.stats.paid;
  const actionIsPositive = ["admitted", "partially_used", "exited", "returned"].includes(actionResult?.outcome ?? "");
  const totalPages = Math.max(1, Math.ceil((overview?.pagination.total ?? 0) / 10));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-gold">Event operations</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Bra Fie Night tickets</h1>
          <p className="mt-1 text-sm text-slate-400">Manage ticket sales and check guests in at the gate.</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="btn-ghost inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {pageError ? <Alert tone="error">{pageError}</Alert> : null}
      {loading && !overview ? <p className="text-sm text-slate-400">Loading event ticketing…</p> : null}

      {overview ? (
        <>
          <section aria-label="Ticket sales summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Summary label="Paid orders" value={String(paidStats?.orders ?? 0)} />
            <Summary label="Tickets sold" value={String(paidStats?.tickets ?? 0)} />
            <Summary label="Confirmed revenue" value={formatCurrency(Number(paidStats?.revenue ?? 0))} />
            <Summary label="People checked in" value={String(overview.stats.checked_in ?? 0)} />
          </section>

          <section className="admin-panel p-4 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">Ticket categories</h2>
              <p className="mt-1 text-sm text-slate-400">Prices and inventory updates affect future orders.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {overview.categories.map((category) => (
                <CategoryEditor
                  key={category.id}
                  category={category}
                  saving={savingCategory === category.id}
                  onSave={saveCategory}
                />
              ))}
            </div>
          </section>

          <section className="admin-panel p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <QrCode className="h-5 w-5 text-brand-gold" />
              <div>
                <h2 className="text-lg font-semibold text-white">Gate scanner</h2>
                <p className="text-sm text-slate-400">Scan or look up a ticket, then admit, exit, or return.</p>
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    Entrance gate
                    <select value={gate} onChange={(event) => setGate(event.target.value)} className="admin-input mt-2 w-full">
                      <option>Gate 1</option>
                      <option>Gate 2</option>
                      <option>Gate 3</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-300">
                    Guests in this action
                    <select
                      value={admissionCount}
                      onChange={(event) => setAdmissionCount(Number(event.target.value))}
                      className="admin-input mt-2 w-full"
                    >
                      <option value={1}>1 guest</option>
                      <option value={2}>2 guests</option>
                    </select>
                  </label>
                </div>
                <button type="button" onClick={scanning ? stopCamera : () => void startCamera()} className="btn-ghost inline-flex items-center gap-2">
                  {scanning ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  {scanning ? "Stop camera" : "Scan QR with camera"}
                </button>
                <video ref={videoRef} className={scanning ? "aspect-video w-full rounded-xl bg-black object-cover" : "hidden"} playsInline muted aria-label="Ticket QR scanner camera" />
                {cameraError ? <p role="status" className="text-sm text-amber-200">{cameraError}</p> : null}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void lookupTicket();
                  }}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <label htmlFor="ticket-code" className="sr-only">Ticket number, QR code, or guest name</label>
                  <input
                    id="ticket-code"
                    value={ticketCode}
                    onChange={(event) => setTicketCode(event.target.value)}
                    autoComplete="off"
                    className="admin-input min-w-0 flex-1"
                    placeholder="Ticket number, QR code, or guest name"
                  />
                  <button type="submit" className="btn-gold inline-flex items-center justify-center gap-2">
                    <Ticket className="h-4 w-4" />
                    Verify ticket
                  </button>
                </form>
                {scanError ? <Alert tone="error">{scanError}</Alert> : null}
                {previewMatches.length > 1 ? (
                  <div className="space-y-2 rounded-xl border border-white/10 p-3">
                    <p className="text-sm font-medium text-white">Select a matching ticket</p>
                    {previewMatches.map((match) => (
                      <button
                        key={match.ticket_id}
                        type="button"
                        onClick={() => {
                          setPreview(match);
                          setPreviewMatches([]);
                          setTicketCode(match.ticket_number ?? "");
                        }}
                        className="flex w-full flex-col rounded-lg border border-white/10 px-3 py-2 text-left hover:bg-white/5"
                      >
                        <span className="font-medium text-white">{match.purchaser_name}</span>
                        <span className="text-xs text-slate-400">
                          {match.ticket_number} · {match.category} · {match.purchaser_email || match.purchaser_phone}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {preview ? (
                  <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4">
                    <p className="mt-1 text-lg font-semibold text-white">{preview.purchaser_name}</p>
                    <p className="text-sm text-slate-300">{preview.purchaser_email || "—"}</p>
                    <p className="text-sm text-slate-300">{preview.purchaser_phone}</p>
                    <p className="mt-2 text-sm text-slate-200">
                      {preview.category} · ticket {preview.ticket_number} · inside {preview.currently_inside}/{preview.admission_entitlement} · used {preview.admissions_used} · outside {preview.outside}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={acting || !preview.can_enter}
                        onClick={() => void applyGateAction("enter")}
                        className="btn-gold inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        {acting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Admit
                      </button>
                      <button
                        type="button"
                        disabled={acting || !preview.can_exit}
                        onClick={() => void applyGateAction("exit")}
                        className="btn-ghost disabled:opacity-50"
                      >
                        Mark going out
                      </button>
                      <button
                        type="button"
                        disabled={acting || !preview.can_return}
                        onClick={() => void applyGateAction("return")}
                        className="btn-ghost disabled:opacity-50"
                      >
                        Return / re-enter
                      </button>
                    </div>
                  </div>
                ) : null}
                {actionResult?.outcome ? (
                  <div
                    role="status"
                    className={`rounded-xl border p-4 ${actionIsPositive
                      ? "border-emerald-400/30 bg-emerald-950/30"
                      : "border-red-400/30 bg-red-950/30"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {actionIsPositive ? <Check className="h-5 w-5 text-emerald-300" /> : <CircleAlert className="h-5 w-5 text-red-300" />}
                      <p className="font-semibold capitalize text-white">{actionResult.outcome.replaceAll("_", " ")}</p>
                    </div>
                    {actionResult.message ? <p className="mt-2 text-sm text-slate-200">{actionResult.message}</p> : null}
                    {actionResult.history?.length ? (
                      <ul className="mt-3 space-y-1 border-t border-white/10 pt-2 text-xs text-slate-300">
                        {actionResult.history.map((entry, index) => (
                          <li key={`${entry.at}-${index}`}>
                            {entry.count} {entry.direction || "enter"} · {entry.gate} · {new Date(entry.at).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-4">
                <p className="text-sm font-semibold text-amber-100">Double tickets</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  One QR covers both guests. Admit 1 or 2 as needed.
                </p>
              </div>
            </div>
          </section>

          <section className="admin-panel overflow-hidden">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Recent orders</h2>
                <p className="mt-1 text-sm text-slate-400">Only paid orders count towards confirmed revenue.</p>
              </div>
              <label className="relative block w-full sm:max-w-xs">
                <span className="sr-only">Search orders by name, ticket number, reference or payment</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, ticket, reference…" className="admin-input w-full !pl-9" />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Purchaser</th>
                    <th className="px-4 py-3 font-medium">Ticket</th>
                    <th className="px-4 py-3 font-medium">Ticket number</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {overview.orders.map((order) => (
                    <tr key={order.reference}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{order.purchaser_name}</p>
                        <p className="text-xs text-slate-400">{order.purchaser_email || "No email"}</p>
                        <p className="mt-1 break-all text-xs text-slate-400">{order.reference}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{order.category}</td>
                      <td className="px-4 py-3 text-slate-300">{order.ticket_numbers?.length ? order.ticket_numbers.map((number) => <p key={number} className="font-mono text-xs">{number}</p>) : <span className="text-slate-500">Not issued</span>}</td>
                      <td className="px-4 py-3 text-slate-300">{order.quantity}</td>
                      <td className="px-4 py-3 text-slate-300">{formatCurrency(Number(order.amount))}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs capitalize ${order.status === "paid" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/10 text-slate-300"
                          }`}>{order.status.replaceAll("_", " ")}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <div className="space-y-1 break-words text-xs">
                          <p>{order.payment_method.toUpperCase()}</p>
                          {order.manual_payment_reference ? <p>{order.manual_payment_reference}</p> : null}
                          {order.manual_payment_sender_name || order.manual_payment_phone ? <p>{order.manual_payment_sender_name || order.manual_payment_phone}</p> : null}
                        </div>
                        {order.status === "payment_submitted" && (order.payment_method === "momo" || order.payment_method === "bank") ? (
                          <div className="mt-2 flex gap-2">
                            <button type="button" disabled={!!reviewingOrder} onClick={() => void reviewOrder(order, "confirm")} className="rounded border border-emerald-400/40 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-50">Confirm</button>
                            <button type="button" disabled={!!reviewingOrder} onClick={() => void reviewOrder(order, "reject")} className="rounded border border-red-400/40 px-2 py-1 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-50">Reject</button>
                          </div>
                        ) : null}
                        {order.status === "paid" ? (
                          <div className="mt-2">
                            <button type="button" disabled={!!reviewingOrder} onClick={() => void resendDelivery(order)} className="rounded border border-white/20 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50">Resend ticket</button>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{new Date(order.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {!overview.orders.length ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{search ? "No matching orders." : "No ticket orders yet."}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3 text-sm text-slate-400">
              <p>{overview.pagination.total} orders · Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button type="button" title="Previous page" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded border border-white/15 p-2 text-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" title="Next page" aria-label="Next page" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded border border-white/15 p-2 text-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-panel p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function CategoryEditor({
  category,
  saving,
  onSave,
}: {
  category: Category;
  saving: boolean;
  onSave: (event: React.FormEvent<HTMLFormElement>, category: Category, price: string, inventory: string, isActive: boolean) => void;
}) {
  const [price, setPrice] = useState(String(category.price));
  const [inventory, setInventory] = useState(category.inventory_limit === null ? "" : String(category.inventory_limit));
  const [isActive, setIsActive] = useState(category.is_active);

  useEffect(() => {
    setPrice(String(category.price));
    setInventory(category.inventory_limit === null ? "" : String(category.inventory_limit));
    setIsActive(category.is_active);
  }, [category.price, category.inventory_limit, category.is_active]);

  return (
    <form onSubmit={(event) => onSave(event, category, price, inventory, isActive)} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{category.name}</h3>
          <p className="mt-1 text-xs text-slate-400">{category.admissions_per_ticket} admission(s) · {category.sold_quantity} sold · {category.reserved_quantity} reserved</p>
        </div>
        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">
          {category.inventory_remaining === null ? "Unlimited" : `${category.inventory_remaining} left`}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            Price (GHS)
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="admin-input mt-1.5 w-full"
            />
          </label>
          <label className="text-xs text-slate-400">
            Total ticket limit
            <input
              type="number"
              min={category.sold_quantity + category.reserved_quantity}
              value={inventory}
              onChange={(event) => setInventory(event.target.value)}
              className="admin-input mt-1.5 w-full"
              placeholder="Unlimited"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-brand-gold"
          />
          <span>Active & visible to buyers</span>
        </label>
      </div>
      <button type="submit" disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50">
        {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Save category
      </button>
    </form>
  );
}
