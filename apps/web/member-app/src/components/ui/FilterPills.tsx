"use client";

export interface FilterPillOption<T extends string = string> {
  value: T;
  label: string;
}

export function FilterPills<T extends string = string>({
  options,
  value,
  onChange,
}: {
  options: FilterPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value || "all"}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-brand-navy text-white"
                : "bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
