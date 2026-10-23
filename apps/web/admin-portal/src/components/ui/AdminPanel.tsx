export function AdminPanel({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={`admin-panel ${padded ? "p-4 sm:p-5" : ""} ${className}`.trim()}>{children}</div>
  );
}

export function FormSection({
  title,
  description,
  children,
  step,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  step?: number;
}) {
  return (
    <section className="space-y-3 border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        {step != null ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gold/20 text-xs font-bold text-brand-gold">
            {step}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
        </div>
      </div>
      <div className={step != null ? "sm:pl-9" : ""}>{children}</div>
    </section>
  );
}
