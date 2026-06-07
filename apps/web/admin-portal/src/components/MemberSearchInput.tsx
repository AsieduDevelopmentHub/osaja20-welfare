"use client";

import type { Member } from "@osaja/types";
import { Search } from "lucide-react";
import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mapMember } from "@/lib/types";

interface MemberSearchInputProps {
  onSelect: (member: Member) => void;
  placeholder?: string;
}

export function MemberSearchInput({ onSelect, placeholder = "Search by name, email, or member ID..." }: MemberSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch<Record<string, unknown>[]>(
        `/members/search?q=${encodeURIComponent(query.trim())}&limit=8`
      );
      setResults((res.data ?? []).map((m) => mapMember(m)));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-brand-gold"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark disabled:opacity-50"
        >
          Search
        </button>
      </form>
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
                }}
                className="w-full px-4 py-3 text-left transition hover:bg-white/5"
              >
                <p className="font-medium text-white">{m.fullName}</p>
                <p className="text-xs text-slate-400">
                  {m.membershipId} · {m.email}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
