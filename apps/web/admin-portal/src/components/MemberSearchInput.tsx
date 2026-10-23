"use client";

import type { Member } from "@osaja/types";
import { Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mapMember } from "@/lib/types";

interface MemberSearchInputProps {
  onSelect: (member: Member) => void;
  selected?: Member | null;
  placeholder?: string;
  autoSearch?: boolean;
  onClear?: () => void;
}

export function MemberSearchInput({
  onSelect,
  selected,
  placeholder = "Search by name, email, or member ID...",
  autoSearch = true,
  onClear,
}: MemberSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const res = await apiFetch<Record<string, unknown>[]>(
        `/members/search?q=${encodeURIComponent(trimmed)}&limit=8`
      );
      if (id !== requestId.current) return;
      setResults((res.data ?? []).map((m) => mapMember(m)));
    } catch (err) {
      if (id !== requestId.current) return;
      setResults([]);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, autoSearch, runSearch]);

  const clearSelection = () => {
    onClear?.();
  };

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (debounceRef.current) clearTimeout(debounceRef.current);
                runSearch(query);
              }
            }}
            placeholder={placeholder}
            className="input-dark pl-10 pr-4"
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />
          ) : null}
        </div>
        {!autoSearch ? (
          <button type="button" disabled={loading} onClick={() => runSearch(query)} className="btn-gold">
            Search
          </button>
        ) : null}
      </div>

      {selected ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-brand-gold/10 px-3 py-2 ring-1 ring-brand-gold/20">
          <p className="min-w-0 truncate text-sm text-brand-gold">
            Selected: <span className="font-semibold">{selected.fullName}</span> ({selected.membershipId})
          </p>
          {onClear ? (
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-lg p-1 text-brand-gold/80 hover:bg-brand-gold/10 hover:text-brand-gold"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          {autoSearch ? "Type to search — results appear as you type." : "Search and click a member to select them."}
        </p>
      )}

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

      {results.length > 0 ? (
        <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(m);
                  setResults([]);
                  setQuery("");
                  setSearched(false);
                }}
                className={`w-full px-4 py-3 text-left transition hover:bg-white/5 ${
                  selected?.id === m.id ? "bg-brand-gold/10" : ""
                }`}
              >
                <p className="font-medium text-white">{m.fullName}</p>
                <p className="text-xs text-slate-400">
                  {m.membershipId} · {m.email}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : searched && !loading && !error ? (
        <p className="mt-2 text-xs text-slate-400">No members matched that search.</p>
      ) : null}
    </div>
  );
}
