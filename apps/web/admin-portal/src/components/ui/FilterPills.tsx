"use client";

export interface FilterPillOption<T extends string = string> {
  value: T;
  label: string;
}

export function FilterPills<T extends string = string>({
  options,
  value,
  onChange,
  size = "sm",
}: {
  options: FilterPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "md" ? "px-4 py-1.5 text-sm" : "px-3 py-1.5 text-xs";

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value || "all"}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full font-semibold transition ${pad} ${
              active
                ? "bg-brand-gold text-brand-navy-dark"
                : "bg-white/10 text-slate-300 hover:bg-white/15"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
