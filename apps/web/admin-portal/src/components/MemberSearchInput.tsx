"use client";

import type { Member } from "@osaja/types";
import { Search } from "lucide-react";
import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mapMember } from "@/lib/types";

interface MemberSearchInputProps {
  onSelect: (member: Member) => void;
  selected?: Member | null;
  placeholder?: string;
}

export function MemberSearchInput({
  onSelect,
  selected,
  placeholder = "Search by name, email, or member ID...",
}: MemberSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const res = await apiFetch<Record<string, unknown>[]>(
        `/members/search?q=${encodeURIComponent(query.trim())}&limit=8`
      );
      setResults((res.data ?? []).map((m) => mapMember(m)));
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [query]);

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
                search();
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-brand-gold"
          />
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={search}
          className="rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark disabled:opacity-50"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {selected ? (
        <p className="mt-3 rounded-xl bg-brand-gold/10 px-3 py-2 text-sm text-brand-gold">
          Selected: <span className="font-semibold">{selected.fullName}</span> ({selected.membershipId})
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Search and click a member to select them.</p>
      )}

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

      {results.length > 0 ? (
        <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
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
